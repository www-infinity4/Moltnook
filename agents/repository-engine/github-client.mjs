/** Authenticated GitHub transport for the server-side Moltnook repository runner.
 * Browser Bubbles never sees the credential. No write operation is retried
 * automatically because a lost response may follow a successful mutation.
 */
const ROOT='https://api.github.com/';
const METADATA=/^repos\/www-infinity4\/[A-Za-z0-9_.-]{1,100}$/;
const safeRoute=route=>typeof route==='string'&&route.length<=360&&
 /^(?:repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./?=&%+-]*)?|user\/repos\?[A-Za-z0-9_=&%+-]+)$/.test(route)&&
 !/(?:^|\/)\.{1,2}(?:\/|$)|\/\/|%2f|%5c|%2e|[\r\n#@\\]/i.test(route);
const header=(reply,name)=>reply.headers?.get?.(name);
const delayFor=(reply,attempt,now)=>{
 const retry=header(reply,'retry-after');
 if(retry!==null&&retry!==undefined){
  if(/^\d+(?:\.\d+)?$/.test(retry))return Math.ceil(Number(retry)*1000);
  const date=Date.parse(retry);if(Number.isFinite(date))return Math.max(0,date-now());
 }
 const remaining=header(reply,'x-ratelimit-remaining');
 const reset=Number(header(reply,'x-ratelimit-reset'));
 if(remaining==='0'&&Number.isFinite(reset)&&reset>0)return Math.max(0,Math.ceil(reset*1000-now()));
 // GitHub requires at least one minute for a rate limit without timing headers.
 if(reply.status===429)return 60000;
 return Math.min(20000,500*2**attempt);
};
const retryable=(reply)=>[429,500,502,503,504].includes(reply.status)||
 (reply.status===403&&(header(reply,'retry-after')!==null||header(reply,'x-ratelimit-remaining')==='0'));

export function createGithubClient({token,fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,
 maxRetries=2,maxWaitMs=20000,cache=new Map()}={}){
 if(typeof token!=='string'||!token)throw Error('github_credential_unavailable');
 if(!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>4||!Number.isFinite(maxWaitMs)||maxWaitMs<0||maxWaitMs>60000)
  throw Error('github_retry_policy_invalid');
 return async function github(resource,options={}){
  if(!safeRoute(resource))throw Error('github_resource_invalid');
  const method=String(options.method||'GET').toUpperCase();
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))throw Error('github_method_invalid');
  if(method==='GET'&&options.body!==undefined)throw Error('github_get_with_body_invalid');
  const isRead=method==='GET',mayCache=isRead&&METADATA.test(resource);
  const cached=mayCache?cache.get(resource):null;
  const headers={Accept:'application/vnd.github+json','Content-Type':'application/json',
   'X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token};
  if(cached?.etag)headers['If-None-Match']=cached.etag;
  for(let attempt=0;;attempt++){
   let reply;
   try{
    reply=await fetchImpl(ROOT+resource,{method,headers,
     ...(options.body!==undefined?{body:JSON.stringify(options.body)}:{}),
     signal:AbortSignal.timeout(20000)});
   }catch{
    if(isRead&&attempt<maxRetries){await sleep(Math.min(maxWaitMs,500*2**attempt));continue;}
    throw Error(isRead?'github_read_network_unavailable':'github_write_unconfirmed_network');
   }
   if(reply.status===304){
    if(!cached?.etag)throw Error('github_cache_miss_304');
    return cached.value;
   }
   if(reply.ok){
    if(reply.status===204)return {};
    let value;try{value=await reply.json()}catch{throw Error('github_response_invalid_json')}
    const etag=mayCache?header(reply,'etag'):null;
    if(etag&&typeof etag==='string'&&etag.length<200)cache.set(resource,{etag,value});
    return value;
   }
   // A failed POST/PATCH/PUT/DELETE may already have mutated remote state.
   // Inspect the authoritative resource using a fresh read before retrying.
   if(!isRead)throw Error('github_write_unconfirmed_http_'+reply.status);
   if(retryable(reply)&&attempt<maxRetries){
    const wait=delayFor(reply,attempt,now);
    if(wait>maxWaitMs)throw Error('github_rate_limit_deferred');
    await sleep(wait);continue;
   }
   throw Error('github_http_'+reply.status);
  }
 };
}
