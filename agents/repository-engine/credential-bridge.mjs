import {pathToFileURL} from 'node:url';
export async function runnerCall(step,body={},request=fetch){
 const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);identityUrl.searchParams.set('audience','infinity-brain-writer');
 const identity=await request(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
 if(!identity.ok)throw Error('github_runner_identity_unavailable');const {value}=await identity.json();
 const response=await request('https://infinity-brain-clock.marvaseater.workers.dev/runner/'+step,{method:'POST',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'brain_runner_call_failed');return result;
}
export async function connectExistingCredential({token=process.env.REPOSITORY_WRITE_TOKEN||'',request=fetch}={}){
 if(!token)return {ok:false,error:'existing_GHP_secret_missing'};
 const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
 identityUrl.searchParams.set('audience','infinity-brain-writer');
 const identity=await request(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
 if(!identity.ok)throw Error('github_runner_identity_unavailable');
 const {value}=await identity.json();
 const response=await request('https://infinity-brain-clock.marvaseater.workers.dev/runner/github-credential',{method:'POST',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.error||'github_credential_bridge_failed');
 // Never include the token, OIDC identity or request headers in logs/artifacts.
 return {ok:true,status:result.status,login:result.login,source:result.source,verifiedAt:result.verifiedAt};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await connectExistingCredential()));}catch(error){console.error(String(error.message));process.exitCode=1;}
}
