/**
 * One-shot dispatch request for the ALREADY reviewed owner-only REA fork
 * workflow. This helper never forks a repo or claims fork verification.
 * It only asks GitHub to launch the existing allowlisted workflow on main.
 */
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const TITLE='Request Bubbles approved REA source fork 20261116';
const REPOSITORY='www-infinity4/Moltnook';
const CLAIM_REF='refs/tags/bubbles-rea-fork-dispatch-20261116';
const SHA=/^[a-f0-9]{40}$/i;
const DISPATCH='https://api.github.com/repos/www-infinity4/Moltnook/actions/workflows/bubbles-approved-tool-forks.yml/dispatches';

export function assertOneTimeOwnerContext({eventName,actor,ref,repository,runAttempt,headMessage,sourceSha}={}){
 if(eventName!=='push'||actor!=='www-infinity4'||ref!=='refs/heads/main'||
    repository!==REPOSITORY||String(runAttempt)!=='1'||!SHA.test(sourceSha||'')||
    typeof headMessage!=='string'||headMessage.split(/\r?\n/,1)[0]!==TITLE)
   throw Error('owner_only_one_time_dispatch_required');
 return true;
}
export async function dispatchApprovedReaOnce(token,{request=fetch,...context}={}){
 assertOneTimeOwnerContext(context);
 if(!token)throw Error('owner_github_credential_missing');
 const headers={authorization:'Bearer '+token,accept:'application/vnd.github+json',
   'content-type':'application/json','x-github-api-version':'2022-11-28'};
 const owner=await request('https://api.github.com/user',{method:'GET',headers,redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(owner.status!==200)throw Error('credential_identity_unavailable_'+owner.status);
 const identity=await owner.json();
 if(identity?.login!=='www-infinity4')throw Error('credential_owner_mismatch');
 // Reserve an atomic, persistent one-time Git ref claim BEFORE dispatching.
 // If a claim exists or its response is ambiguous, do not dispatch.
 const claim=await request('https://api.github.com/repos/'+REPOSITORY+'/git/refs',{method:'POST',headers,redirect:'manual',
   signal:AbortSignal.timeout(20000),body:JSON.stringify({ref:CLAIM_REF,sha:context.sourceSha})});
 if(claim.status!==201)throw Error('one_time_claim_refused_'+claim.status);
 // POST exactly once. A rejected or ambiguous result is NOT retried here.
 const response=await request(DISPATCH,{method:'POST',headers,redirect:'manual',
   signal:AbortSignal.timeout(20000),body:JSON.stringify({ref:'main',inputs:{tool:'rea'}})});
 if(response.status!==204)throw Error('dispatch_not_accepted_'+response.status);
 return {schemaVersion:1,status:'dispatch_accepted',source:'morluto/rea',
   dispatchWorkflow:'bubbles-approved-tool-forks.yml',repository:REPOSITORY,
   forkVerified:false,runtimeInstalled:false,brainToolConnected:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let receipt={schemaVersion:1,status:'blocked',forkVerified:false,runtimeInstalled:false};
 try{
  const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  receipt=await dispatchApprovedReaOnce(process.env.REPOSITORY_WRITE_TOKEN,{
   eventName:process.env.GITHUB_EVENT_NAME,actor:process.env.GITHUB_ACTOR,
   ref:process.env.GITHUB_REF,repository:process.env.GITHUB_REPOSITORY,
   runAttempt:process.env.GITHUB_RUN_ATTEMPT,headMessage:event.head_commit?.message,
   sourceSha:process.env.GITHUB_SHA
  });
 }catch(e){receipt.error=String(e?.message||'dispatch_failed').slice(0,160);process.exitCode=1;}
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/bubbles-rea-once-dispatch.json',JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt));
}
