// #1921: signed, bounded Bubbles conversation followed by existing Brain D1
// owner-work intake. No ChatGPT app impersonation, new key, wallet action,
// privileged model-tool delegation, or unverified completion receipt.
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const CHAT='https://bubbles-cloud-browser.marvaseater.workers.dev/v1/browser/chatgpt/runner';
const BRIDGE='https://infinity-brain-clock.marvaseater.workers.dev/owner/bridge-work';
const ORDER_ID='avatar-1921-session-02';
const REPO='www-infinity4/QuantaPhi';
const PROMPTS=[
 'For the owner-approved QuantaPhi #1921 engineering handoff, inspect only public Bubbles/Brain capabilities and explain which signed conversation and tool receipts you actually observe. Do not claim GitHub changes, owner archives, release or Android control.',
 'Describe the exact dependency, independent-review and CI requirements that should stop the second owner-authorized engineering job until the first is verified. Do not run privileged tools or claim an already completed deployment.'
];
// Instructions are owner-approved and checked into git; NEVER derived from
// generated model text, which is untrusted for authorization.
const JOBS=[
 {id:'TASK-1',dependencies:[],instructions:
  'Continue QuantaPhi #1921 and #1907, including PR #1926. Validate signed assist/result and existing D1 owner bridge source, regression-test replay and failure recovery, preserve permission checks, implement only verified source repairs, and obtain exact-head CI and independent review before any eligible merge.'},
 {id:'TASK-2',dependencies:['TASK-1'],instructions:
  'After verified completion of TASK-1 in the same owner ticket, resume QuantaPhi #1921 and Moltnook repository-engine integration. Verify a second authenticated runner claim, source/test/PR receipts, recovery checkpoint, guarded release and actual Android/browser readback. Keep unverifiable parts blocked; never bypass approvals or mint rewards.'}
];
function safe(s,n=160){return String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n);}
export async function runSignedAvatarHandoff({runId,sourceSha,send}={}){
 if(!/^\d{1,24}$/.test(runId||'')||!/^[a-f0-9]{40}$/.test(sourceSha||'')||
  typeof send!=='function')throw Error('invalid_handoff_scope');
 const grant=await send('conversation',{operation:'status'});
 if(grant?.ok!==true||grant.jobId!=='chatgpt_runner_'+runId)
  throw Error('signed_grant_unavailable');
 const conversationTurns=[];
 for(let turn=0;turn<PROMPTS.length;turn++){
  const assist=await send('conversation',{operation:'assist',text:PROMPTS[turn],turn});
  if(assist?.ok!==true||assist.state!=='complete')throw Error('signed_conversation_unverified_'+turn);
  const response=await send('conversation',{operation:'result',turn});
  if(response?.ok!==true||response.state!=='complete'||
      response.result?.ok!==true||typeof response.result.output!=='string'||
      !response.result.output.trim())
   throw Error('signed_conversation_unverified_'+turn);
  conversationTurns.push({turn,state:'complete',
   tool:safe(response.result.receipt?.tool,70)||null,
   toolStatus:safe(response.result.receipt?.status,60)||null,
   outputPreview:safe(response.result.output,320)});
 }
 const packet={repository:REPO,request:'Continue the owner-authorized Bubbles GPT continuous Avatar AI job chain in canonical QuantaPhi issue #1921, keeping two dependency-linked engineering stages in the existing signed Brain/D1 runner. No new tickets, unsafe merges or fabricated receipts.',
  orderId:ORDER_ID,sourceSha,jobs:JOBS};
 const saved=await send('bridge',packet);
 if(saved?.ok!==true||saved?.repository!==REPO||
   saved?.orderId!==ORDER_ID||saved?.sourceSha!==sourceSha||
   saved?.jobCount!==JOBS.length||typeof saved.ticketId!=='string'||
   saved.completed!==false)
  throw Error('signed_owner_bridge_rejected');
 return {when:new Date().toISOString(),orderId:ORDER_ID,sourceSha,jobCount:JOBS.length,
  ticketId:safe(saved.ticketId,100),deduplicated:saved.deduplicated===true,
  execution:{status:safe(saved.execution?.status,70)||'unverified'},
  conversationTurns,completed:false,merged:false,deployed:false,androidVerified:false};
}
async function post(endpoint,token,payload,timeoutMs){
 const res=await fetch(endpoint,{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(timeoutMs)});
 let value={};try{value=await res.json()}catch{}
 if(!res.ok||value.ok!==true)throw Error('signed_request_rejected_'+res.status+'_'+safe(value.error,70));
 return value;
}
async function main(){
 const u=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'');
 u.searchParams.set('audience','bubbles-owner-message-bridge');
 const auth=await fetch(u,{headers:{Authorization:'Bearer '+(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'')},
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!auth.ok)throw Error('signed_oidc_unavailable_'+auth.status);
 const token=(await auth.json()).value;
 if(typeof token!=='string'||token.length<20)throw Error('signed_oidc_missing');
 const head=await fetch('https://api.github.com/repos/'+REPO+'/commits/main',{
  headers:{Accept:'application/vnd.github+json','User-Agent':'Moltnook-Signed-Avatar-Handoff'},
  redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!head.ok)throw Error('quanta_head_unavailable_'+head.status);
 const sourceSha=(await head.json()).sha;
 const result=await runSignedAvatarHandoff({runId:process.env.GITHUB_RUN_ID,sourceSha,
  send:(kind,payload)=>post(kind==='bridge'?BRIDGE:CHAT,token,payload,
    kind==='bridge'?90000:payload.operation==='assist'?120000:15000)});
 await mkdir('repository-receipts',{recursive:true});
 await writeFile('repository-receipts/avatar-handoff-1921.json',JSON.stringify(result,null,2)+'\n');
 console.log('AVATAR_SIGNED_HANDOFF '+JSON.stringify({orderId:result.orderId,sourceSha:result.sourceSha,
  jobCount:result.jobCount,conversationTurns:result.conversationTurns.length,
  ticketId:result.ticketId,status:result.execution.status,completed:false,androidVerified:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 main().catch(async e=>{
  const failure={when:new Date().toISOString(),orderId:ORDER_ID,status:'blocked',
   error:safe(e?.message||e,160),jobsCreated:'unverified',merged:false,deployed:false,androidVerified:false};
  try{await mkdir('repository-receipts',{recursive:true});await writeFile(
   'repository-receipts/avatar-handoff-1921.json',JSON.stringify(failure,null,2)+'\n');}catch{}
  console.error('AVATAR_SIGNED_HANDOFF_BLOCKED '+failure.error);process.exitCode=1;
 });
