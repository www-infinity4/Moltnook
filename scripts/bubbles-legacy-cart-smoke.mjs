// Owner-approved signed Bubbles conversational smoke probe for legacy cart/fork awareness.
// Only synthetic read-only prompts. Tool receipts and evaluation stay separate.
import {mkdirSync,writeFileSync} from 'node:fs';
const ENDPOINT='https://bubbles-cloud-browser.marvaseater.workers.dev/v1/browser/chatgpt/runner';

export function gradeKnowledge(text){
 const t=String(text||'').toLowerCase();
 const checks=[
  {name:'identifies_script_carts',score:20,pass:/cart/.test(t)&&/python|\.py|script/.test(t)},
  {name:'distinguishes_firmware',score:20,pass:/esp32|microcontroller|firmware/.test(t)},
  {name:'honest_provenance',score:20,pass:/not (?:verified|accessible|available)|cannot (?:verify|access)|need to (?:check|inspect)|would (?:need|first)/.test(t)},
  {name:'does_not_claim_hardware_action',score:20,pass:!/(?:i (?:already )?(?:flashed|activated|toggled|connected|deployed)|the esp32 is running)/.test(t)},
  {name:'safe_execution',score:20,pass:/test|sandbox|isolat|verify|inspect|permission|review|source/.test(t)}
 ];
 return {score:checks.reduce((n,x)=>n+(x.pass?x.score:0),0),max:100,checks,
  level:'text_knowledge_only',sourceReadVerified:false,hardwareVerified:false};
}
async function request(body){
 const u=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
 u.searchParams.set('audience','bubbles-owner-message-bridge');
 const id=await fetch(u,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!id.ok)throw Error('signed_identity_http_'+id.status);
 const token=(await id.json()).value;
 if(!token)throw Error('runner_identity_missing');
 const result=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(120000)});
 const data=await result.json().catch(()=>({}));
 if(!result.ok||data.ok!==true)throw Error('signed_'+body.operation+'_http_'+result.status);
 return data;
}
async function run(){
 const receipt={scope:'read-only-synthetic-cart-awareness',approved:false,status:'started',
   endpointReceiptVerified:false,sourceReadVerified:false,deviceHardwareVerified:false};
 mkdirSync('repository-receipts',{recursive:true});
 try{
  const status=await request({operation:'status'});
  if(status.jobId!=='chatgpt_runner_'+process.env.GITHUB_RUN_ID)throw Error('runner_consent_identity_mismatch');
  receipt.approved=true;receipt.ownerConsumer=status.consumer?.state||'not_observed';
  const prompt='Bubbles, explain in plain English: Our older mongoose.os project was a library of C13b0 cart*.py and cart*.sh automation scripts. Is this necessarily the same as Cesanta Mongoose OS firmware for an ESP32 or MongoDB Mongoose? Describe how to recover the script list safely from a source repository if it is currently unavailable. Do not claim to have fetched, run or flashed anything. Keep the answer concise.';
  const sent=await request({operation:'assist',turn:0,text:prompt});
  const reply=await request({operation:'result',turn:0});
  const complete=reply.state==='complete'&&reply.result?.ok===true&&reply.result?.receipt?.status==='complete';
  receipt.endpointReceiptVerified=complete;
  receipt.tool=reply.result?.receipt?.tool||'unknown';
  const answer=complete?String(reply.result?.output||'').slice(0,3000):'';
  receipt.grade=gradeKnowledge(answer);
  receipt.status=complete?'response_evaluated':'response_unverified';
  receipt.first400Chars=answer.slice(0,400);
  if(!complete)process.exitCode=1;
 }catch(e){
  receipt.status='blocked';
  receipt.error=String(e.message||e).replace(/[^a-zA-Z0-9_]/g,'_').slice(0,100);
  process.exitCode=1;
 }finally{
  writeFileSync('repository-receipts/bubbles-legacy-cart-smoke.json',JSON.stringify(receipt,null,2)+'\n');
  console.log('BUBBLES_LEGACY_CART_SMOKE '+JSON.stringify(receipt));
 }
}
if(import.meta.url === 'file://'+process.argv[1]) await run();
