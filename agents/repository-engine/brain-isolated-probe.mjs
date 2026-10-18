import {BrainClock} from './worker.js';
import {filterActiveTickets} from './ticket-selector.mjs';
import {sourceRecoveryEligibility} from './deferred-recovery.mjs';
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
  const ok=ownerDecisionProtected&&currentWorkSelected&&
   sourceRecovery.eligible===true&&clockReady;
  return Response.json({ok,mode:'isolated_preview_only',ticketCount:row.total,
   sourceDecisionVerified:ownerDecisionProtected,
   ownerPriorityVerified:currentWorkSelected,
   recoveryEligible:sourceRecovery.eligible,
   distinctClockReady:clockReady,
   productionTrafficTouched:false,
   ownerOrWalletOperationsAllowed:false
  },{status:ok?200:503,headers:{'Cache-Control':'no-store'}});
 }
};
