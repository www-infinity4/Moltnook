import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {assessRollout} from './rollout-gate.mjs';import {executionContext} from './execution-context.mjs';
const account='ef25728c096c6ba92cf510caa2058003';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const normalize=v=>JSON.stringify([...v].sort((a,b)=>a.version_id.localeCompare(b.version_id)));
export async function evaluateRollout({evidence,token,context=executionContext(),fetcher=fetch}){
 if(!context.productionAccess)return {action:'hold',executed:false,reason:'Isolated execution context'};
 if(!evidence)return {action:'hold',executed:false,reason:'No verified release evidence supplied'};
 const decision=assessRollout(evidence);
 // BrainClock is an existing stateful singleton Durable Object. Cloudflare
 // selects a DO version per instance, not independently for each HTTP call.
 // Automatic percentage promotion cannot provide an isolated canary.
 // A verified rollback to the known-stable 100% version remains permitted.
 if(evidence.workerName==='infinity-brain-clock'&&decision.action==='promote')
  return {action:'hold',executed:false,weight:0,
   reason:'BrainClock singleton requires isolated Preview and an explicit whole-version owner release; percentage traffic rollout is blocked'};
 if(!['promote','rollback'].includes(decision.action))return {...decision,executed:false};
 if(!['quantaphi-site','infinity-brain-clock'].includes(evidence.workerName)||![evidence.candidate.versionId,evidence.stable.versionId].every(id=>uuid.test(id)))throw Error('Worker or release ID outside rollout scope');
 if(!token)return {...decision,executed:false,reason:'CLOUDFLARE_API_TOKEN missing; no deployment mutation attempted'};
 const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+evidence.workerName+'/deployments';
 async function api(method,body){const r=await fetcher(endpoint,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok||j.success!==true)throw Error('Cloudflare deployment API rejected '+method+' request');return j.result;}
 const current=(await api('GET')).deployments?.[0];
 if(!current||current.id!==evidence.expectedDeploymentId)throw Error('Deployment changed since verified observation; reassessment required');
 const allowed=new Set([evidence.candidate.versionId,evidence.stable.versionId]);if(current.versions.some(v=>!allowed.has(v.version_id)))throw Error('Unrelated live version detected');
 const currentWeight=(current.versions.find(v=>v.version_id===evidence.candidate.versionId)?.percentage||0)/100;if(currentWeight!==evidence.weight)throw Error('Live traffic weight differs from observation');
 const versions=decision.action==='rollback'?[{version_id:evidence.stable.versionId,percentage:100}]:[{version_id:evidence.candidate.versionId,percentage:decision.weight*100},...(decision.weight<1?[{version_id:evidence.stable.versionId,percentage:100-decision.weight*100}]:[])];
 const deployed=await api('POST',{strategy:'percentage',versions,annotations:{'workers/message':'Infinity verified '+decision.action}});
 const readback=(await api('GET')).deployments?.[0];
 if(!deployed.id||readback?.id!==deployed.id||normalize(readback.versions)!==normalize(versions))throw Error('Deployment mutation read-back mismatch; manual investigation required');
 return {...decision,executed:true,deploymentId:deployed.id,versions,readbackVerified:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let evidence;try{evidence=JSON.parse(await fs.readFile('repository-receipts/rollout-evidence.json','utf8'))}catch{}
 let receipt;try{receipt=await evaluateRollout({evidence,token:process.env.CLOUDFLARE_API_TOKEN||''})}catch(e){receipt={action:'blocked',executed:false,error:String(e.message)};process.exitCode=1;}
 await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/rollout-execution.json',JSON.stringify(receipt,null,2));console.log(receipt.action,receipt.executed?'executed and verified':receipt.reason||receipt.error);
}
