import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const languageUpstreams=Object.freeze(['astral-sh/uv','astral-sh/ruff']);
export async function forkLanguageUpstreams(token,{request=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(!token)throw Error('existing_owner_github_key_missing');
 const api=async(path,method='GET',body)=>{
  const response=await request('https://api.github.com'+path,{method,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Bubbles-Language-Adapters'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
 };
 const identity=await api('/user');
 if(identity.status!==200||identity.data.login?.toLowerCase()!=='www-infinity4')throw Error('fork_owner_mismatch');
 const receipts=[];
 for(const upstream of languageUpstreams){
  const target='www-infinity4/'+upstream.split('/')[1];
  let state=await api('/repos/'+target),submitted=false;
  if(state.status===404){
   // Never retry a POST after an ambiguous response. A later run first reads
   // the target and validates its parent, so an existing fork is reused.
   let created;
   try{created=await api('/repos/'+upstream+'/forks','POST',{name:target.split('/')[1],default_branch_only:true})}
   catch{receipts.push({upstream,target,status:'unconfirmed',mutationSubmitted:true});continue;}
   submitted=true;
   if(![201,202].includes(created.status)){receipts.push({upstream,target,status:'blocked',httpStatus:created.status,mutationSubmitted:true});continue;}
   for(let attempt=0;attempt<8;attempt++){
    state=await api('/repos/'+target);
    if(state.status!==404)break;
    await pause(1000);
   }
  }
  if(state.status===200&&state.data.full_name?.toLowerCase()===target.toLowerCase()&&state.data.fork===true&&state.data.parent?.full_name===upstream)
   receipts.push({upstream,target,status:'fork_verified',mutationSubmitted:submitted,url:'https://github.com/'+target,defaultBranch:state.data.default_branch,executionVerified:false});
  else receipts.push({upstream,target,status:state.status===404?'unconfirmed':'blocked',mutationSubmitted:submitted,reason:state.status===404?'fork_not_visible_yet':'target_is_not_expected_fork'});
 }
 return {schemaVersion:1,checkedAt:new Date().toISOString(),receipts,verified:receipts.every(r=>r.status==='fork_verified')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await forkLanguageUpstreams(process.env.REPOSITORY_WRITE_TOKEN);
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/bubbles-language-forks.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));if(!result.verified)process.exitCode=1;
}
