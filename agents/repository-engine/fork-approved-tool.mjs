/**
 * Owner-only manual Bubbles tool-fork adapter. No new auth and no arbitrary
 * upstream strings: source selection comes from a reviewed allowlist. The
 * existing Moltnook fork client checks signed-in owner and parent-of-fork.
 *
 * A fork is NOT a connected Bubbles tool, executable, APK or deployment.
 */
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {forkVerifiedUpstreams} from './fork-language-upstreams.mjs';

export const approvedForkTools=Object.freeze({
 rea:Object.freeze({upstream:'morluto/rea',purpose:'authorized local source inspection',license:'MIT',runtimeInstalled:false})
});
export async function forkApprovedTool(token,{tool,request=fetch,pause,actor}={}){
 if(actor!=='www-infinity4')throw Error('owner_actor_required');
 if(!Object.hasOwn(approvedForkTools,tool))throw Error('upstream_not_approved');
 const item=approvedForkTools[tool];
 const result=await forkVerifiedUpstreams(token,[item.upstream],{request,pause});
 return {...result,tool,license:item.license,runtimeInstalled:false,brainToolConnected:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await forkApprovedTool(process.env.REPOSITORY_WRITE_TOKEN,{
   tool:process.env.BUBBLES_FORK_TOOL,actor:process.env.GITHUB_ACTOR
  });
  await fs.mkdir('repository-receipts',{recursive:true});
  await fs.writeFile('repository-receipts/bubbles-approved-tool-fork.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  if(!result.verified)process.exitCode=1;
 }catch(e){console.error('Approved fork blocked: '+e.message);process.exitCode=1}
}
