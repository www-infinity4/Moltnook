// Compatibility entrypoint for safe owner robot promotion.
// Routine merges delegate to the shared exact-head target-CI gate.
// No external GPT/Cloudflare reviewer, untrusted PR authorization or branch bypass.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {runAutoPromotion} from './auto-promote-reviewed.mjs';

const trustedEnvironment=env=>env.GITHUB_ACTIONS==='true'&&
 env.GITHUB_REPOSITORY==='www-infinity4/Moltnook'&&env.GITHUB_REF==='refs/heads/main';

async function diskReceipt(receipt){
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/oracle-promotion-review.json',JSON.stringify(receipt,null,2));
}

export async function run({environment=process.env,promote=runAutoPromotion,writeReceipt=diskReceipt}={}){
 if(!trustedEnvironment(environment))throw Error('Oracle promotion requires trusted Moltnook main');
 const token=environment.REPOSITORY_WRITE_TOKEN||'';
 const report=token
  ?await promote({token,maxMerges:4})
  :{configured:false,scanned:0,merged:[],deferred:[{reason:'missing_writer_credential'}],mode:'blocked_missing_writer_credential'};
 const receipt={
  at:new Date().toISOString(),
  policy:'target-ci-owner-scoped-github-merge',
  modelReviewRequired:false,
  ...report
 };
 await writeReceipt(receipt);
 return receipt;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const receipt=await run();
  console.log(JSON.stringify({mode:receipt.mode,scanned:receipt.scanned,merged:receipt.merged,deferred:receipt.deferred}));
  if(!receipt.configured)process.exitCode=1;
 }catch(error){
  console.error(String(error.message||error));
  process.exitCode=1;
 }
}
