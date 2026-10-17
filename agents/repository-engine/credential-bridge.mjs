import {pathToFileURL} from 'node:url';

// The identity request itself sometimes times out before the Brain worker is
// contacted. Retry only temporary GitHub OIDC transport/service errors, never
// credentials, claims, 401/403 or an unverified Brain response. No token logs.
export async function fetchRunnerOidcIdentity({
 request=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),maxAttempts=3
}={}){
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)
  throw Error('github_runner_identity_retry_limit_invalid');
 const endpoint=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
 const runtimeToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(!endpoint||!runtimeToken)throw Error('github_runner_identity_environment_missing');
 const identityUrl=new URL(endpoint);
 identityUrl.searchParams.set('audience','infinity-brain-writer');
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  let retry=false;
  try{
   const response=await request(identityUrl,{
    headers:{Authorization:'Bearer '+runtimeToken},
    signal:AbortSignal.timeout(15000)
   });
   if(response.ok){
    const data=await response.json();
    if(typeof data?.value!=='string'||!data.value)
     throw Error('github_runner_identity_empty_token');
    return data.value;
   }
   if(![429,502,503,504].includes(response.status))
    throw Error('github_runner_identity_http_'+response.status);
   retry=true;
  }catch(error){
   if(error?.name==='AbortError'||error?.name==='TimeoutError'||error?.name==='TypeError')
    retry=true;
   else throw error;
  }
  if(!retry)throw Error('github_runner_identity_unavailable');
  if(attempt===maxAttempts)throw Error('github_runner_identity_transient_exhausted');
  await wait(attempt*500);
 }
 throw Error('github_runner_identity_unavailable');
}
export async function runnerCall(step,body={},request=fetch){
 const value=await fetchRunnerOidcIdentity({request});
 const response=await request('https://infinity-brain-clock.marvaseater.workers.dev/runner/'+step,{
  method:'POST',
  headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(90000)
 });
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.error||'brain_runner_call_failed');
 return result;
}
export async function connectExistingCredential({token=process.env.REPOSITORY_WRITE_TOKEN||'',request=fetch,wait}={}){
 if(!token)return {ok:false,error:'existing_GHP_secret_missing'};
 const value=await fetchRunnerOidcIdentity({request,wait});
 const response=await request('https://infinity-brain-clock.marvaseater.workers.dev/runner/github-credential',{
  method:'POST',
  headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},
  body:JSON.stringify({token}),signal:AbortSignal.timeout(30000)
 });
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.error||'github_credential_bridge_failed');
 // Never include the repository token or GitHub OIDC identity in logs/artifacts.
 return {ok:true,status:result.status,login:result.login,source:result.source,verifiedAt:result.verifiedAt};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await connectExistingCredential()));}
 catch(error){console.error(String(error.message));process.exitCode=1;}
}
