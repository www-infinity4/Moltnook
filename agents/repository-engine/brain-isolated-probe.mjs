import {BrainClock} from './worker.js';
import {filterActiveTickets} from './ticket-selector.mjs';
import {sourceRecoveryEligibility} from './deferred-recovery.mjs';
import {pinnedPinkReview,prioritizeReadOnlyPinkReviews,validatePinkSourceReceipt,completePinkReviewInContext} from './source-review.mjs';
export {BrainClock};

// Transient CI-only Preview wrapper. Nothing is forwarded to live owner,
// GitHub write, wallet, earnings or production scheduling endpoints.
export default {
 async fetch(request,env){
  if(request.method!=='GET'||new URL(request.url).pathname!=='/__preview__/admission')
   return new Response('Not found',{status:404});
  if(env.BRAIN_CANARY_MODE!=='isolated'||env.WRITER_OWNER_HASH||
   env.BOT_WORK_SECRET||env.BOT_WALLET||env.MODELS)
   return Response.json({ok:false,error:'preview_isolation_gate_failed'},{status:503});
  if(!env.CLOCK||!env.WORK_DB)
   return Response.json({ok:false,error:'isolated_do_or_db_missing'},{status:503});
  const row=await env.WORK_DB.prepare('SELECT COUNT(*) AS total FROM work_tickets').first();
  if(Number(row?.total)!==0)
   return Response.json({ok:false,error:'canary_db_not_empty'},{status:503});
  // Anonymous, read-only transport check. No owner token, cookies or consent mutation.
  // A reachable signed endpoint rejects this probe with its fixed 401 code.
  let consentTransport={httpStatus:0,error:'transport_failed',reachable:false};
  try{
   const probe=await fetch('https://bubbles-cloud-browser.marvaseater.workers.dev/v1/browser/chatgpt/runner',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'status'}),
    redirect:'error',signal:AbortSignal.timeout(10000)});
   const raw=await probe.text();
   let body;try{body=JSON.parse(raw)}catch{}
   consentTransport={httpStatus:probe.status,
    error:body?.error==='bridge_runner_not_verified'?'bridge_runner_not_verified':/1042/.test(raw)?'worker_transport_1042':'unrecognized_response',
    reachable:probe.status===401&&body?.error==='bridge_runner_not_verified'};
  }catch{}
  const now=Date.now();
  const legacy={ticket:{id:'LEGACY',created_at:now-4*86400000},job:{
   id:'TASK-4',repository:'www-infinity4/QuantaPhi',
   status:'blocked',queue_priority:95,instructions:'Inspect source',
   progress:{summary:'owner_input_required: owner must specify exact source paths and schema'}
  }};
  const current={ticket:{id:'CURRENT',created_at:now-86400000},job:{
   id:'TASK-1',repository:'www-infinity4/QuantaPhi',
   status:'queued',queue_priority:10,instructions:'Implement verified UI',
   progress:{summary:'Actionable owner job'}
  }};
  const selection=filterActiveTickets([legacy,current],{now});
  const ownerDecisionProtected=selection.deferred.some(x=>x.ticketId==='LEGACY'&&x.reason==='owner_decision_required');
  const currentWorkSelected=selection.allowed.length===1&&selection.allowed[0].ticket.id==='CURRENT';
  const sourceRecovery=sourceRecoveryEligibility({...legacy.job,progress:{
   summary:'Missing exported function signature and JSON schema in source file. Read the named repository source.'
  }},{now});
  const clock=env.CLOCK.get(env.CLOCK.idFromName('isolated-canary-20261017'));
  const response=await clock.fetch('https://clock.internal/status');
  const state=await response.json();
  const clockReady=response.ok&&state.ok===true&&state.writer==null;

  // Exercise the new source-only Pink path against a synthetic merged Green
  // receipt; no GitHub requests, owner tokens, wallet or real tickets exist
  // in this Preview-only wrapper.
  const mergedSha='a'.repeat(40),sourceSha='b'.repeat(40);
  const fake={kind:'robot-directions',color_jobs:[
   {id:'TASK-1',agent:'greenbeans',repository:'www-infinity4/QuantaPhi',status:'merged_verified',
    progress:{mergeSha:mergedSha,commitSha:sourceSha,testsPassed:true,
     prUrl:'https://github.com/www-infinity4/QuantaPhi/pull/418'}},
   {id:'TASK-2',agent:'pink-panther',repository:'www-infinity4/QuantaPhi',status:'blocked',
    dependencies:['TASK-1','TASK-3'],instructions:'After TASK-1, independently verify the requested work: synthetic routing fix'},
   {id:'TASK-3',agent:'greenbeans',repository:'www-infinity4/QuantaPhi',status:'blocked',
    title:'Repair source-routing',instructions:'Diagnose and repair the authenticated source-routing failure'}
  ],technical_handoffs:[{sourceJobId:'TASK-2',repairJobId:'TASK-3',category:'source-routing'}]};
  const pink=fake.color_jobs[1];
  const candidate={ticket:{id:'synthetic-pink'},context:fake,job:pink};
  const bad={ticket:{id:'synthetic-repair'},context:fake,job:fake.color_jobs[2]};
  const review=pinnedPinkReview(fake,pink);
  const prioritized=prioritizeReadOnlyPinkReviews([bad,candidate]);
  const mergedSourceRecognized=review?.kind==='source_review_only'&&review.mayWrite===false&&
    review.mergeSha===mergedSha&&review.prNumber===418&&
    prioritized[0]===candidate;
  let reviewReceiptSafe=false,generatedRepairSuperseded=false,ownerBlockPreserved=false;
  if(mergedSourceRecognized){
   const result=validatePinkSourceReceipt({review,job:pink,body:{
    status:'source_verified',testsPassed:true,reviewedMergeSha:mergedSha,
    commitSha:sourceSha,testPaths:['test/bubbles-brain-actions.test.cjs'],
    productionVerified:false,ownerApprovalGranted:false,mergedNewCode:false
   }});
   const updated=completePinkReviewInContext(fake,pink.id,result,new Date().toISOString(),'synthetic://probe');
   reviewReceiptSafe=result.noReward===true&&result.noNewCommit===true&&result.productionVerified===false&&
     updated.color_jobs[1].status==='complete'&&updated.color_jobs[0].status==='merged_verified';
   generatedRepairSuperseded=updated.color_jobs[2].status==='superseded'&&
     fake.color_jobs[2].status==='blocked';
  }
  const unauthorized=structuredClone(fake);
  unauthorized.technical_handoffs[0].category='tool-connection';
  ownerBlockPreserved=pinnedPinkReview(unauthorized,unauthorized.color_jobs[1])===null;

  const ok=ownerDecisionProtected&&currentWorkSelected&&
   sourceRecovery.eligible===true&&clockReady&&mergedSourceRecognized&&
   reviewReceiptSafe&&generatedRepairSuperseded&&ownerBlockPreserved;
  return Response.json({ok,mode:'isolated_preview_only',ticketCount:row.total,
   consentTransport,
   sourceDecisionVerified:ownerDecisionProtected,
   ownerPriorityVerified:currentWorkSelected,
   recoveryEligible:sourceRecovery.eligible,
   distinctClockReady:clockReady,
   productionTrafficTouched:false,
   ownerOrWalletOperationsAllowed:false,
   mergedSourceRecognized,reviewReceiptSafe,generatedRepairSuperseded,ownerBlockPreserved
  },{status:ok?200:503,headers:{'Cache-Control':'no-store'}});
 }
};
