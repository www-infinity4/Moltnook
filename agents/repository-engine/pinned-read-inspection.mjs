import {dispatchReadJobs} from './parallel-read-dispatch.mjs';

/**
 * Actual read-only handoff for the existing Moltnook GitHub inspector.
 * All checked files are fetched at the same immutable repository commit.
 * No child, API result or source URL can acquire writer permissions.
 */
const safePath=p=>typeof p==='string'&&p.length>0&&p.length<=180&&
 /^[a-zA-Z0-9_.\/-]+$/.test(p)&&!p.startsWith('/')&&
 !p.split('/').some(part=>part==='.'||part==='..'||part==='.git');
const sha40=value=>typeof value==='string'&&/^[0-9a-f]{40}$/i.test(value);

export async function inspectPinnedPaths({paths,commitSha,read,sourceUrl,concurrency=3}={}){
 if(!sha40(commitSha))throw new TypeError('40-character pinned commit SHA required');
 if(!Array.isArray(paths)||paths.length>6||paths.some(p=>!safePath(p))||new Set(paths).size!==paths.length)
  throw new TypeError('at most six distinct safe checked-in paths required');
 if(typeof read!=='function'||typeof sourceUrl!=='function')
  throw new TypeError('authorized source reader and URL builder required');
 const jobs=paths.map((path,index)=>({id:'file-'+index,role:'blue',path}));
 const batch=await dispatchReadJobs(jobs,{blue:async job=>{
  const info=await read(job.path,commitSha);
  if(info?.ok!==true||!sha40(info.sha))
   throw new Error(String(info?.error||'source_read_or_sha_unavailable').slice(0,150));
  const url=sourceUrl(job.path,commitSha);
  if(typeof url!=='string'||!url.startsWith('https://github.com/')||
     !url.includes('/blob/'+commitSha+'/'))
   throw new Error('pinned_source_url_unavailable');
  return {verified:true,source:url,sourceCommitSha:commitSha,contentSha:info.sha};
 }},{concurrency});
 return jobs.map((job,index)=>{
  const item=batch.results[index],verified=item.status==='verified';
  const url=sourceUrl(job.path,commitSha);
  return {path:job.path,found:verified,url,
   sha:verified?item.receipt.contentSha:null,
   error:verified?null:item.error||'read_unverified'};
 });
}
