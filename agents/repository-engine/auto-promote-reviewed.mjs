// Target-CI-gated owner-authorized robot PR promotion.
// Never accepts untrusted PR labels/comments as authorization and never bypasses branch protection.
import fs from 'node:fs/promises';
import {runnerCall} from './credential-bridge.mjs';
import {pathToFileURL} from 'node:url';
const OWNER='www-infinity4';
export const TARGETS=['QuantaPhi','Moltnook','Infinity-Phi','Omni-Phi','News-Phi','Code-Phi','Oracle-Octaves'];
const safePath=path=>typeof path==='string'&&path.length<240&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(p=>!p||p==='.'||p==='..'||p==='.git')&&!/^\.env(?:[.\/]|$)/.test(path);
export function reviewCandidate(pr,files,checks,statuses){
 if(!pr||pr.state!=='open'||pr.draft||pr.mergeable!==true||!['clean','unstable'].includes(pr.mergeable_state))return {ready:false,reason:'not_mergeable'};
 if(!/^www-infinity4\/[A-Za-z0-9_.-]+$/.test(pr.base?.repo?.full_name||'')||pr.base?.repo?.full_name!==OWNER+'/'+pr.base.repo.name||pr.head?.repo?.full_name!==pr.base.repo.full_name)
  return {ready:false,reason:'repository_not_scoped'};
 const direct=/^bubbles\/[0-9a-f-]{36}$/i.test(pr.head?.ref||'');
 if(pr.base.ref!==(pr.base.repo.default_branch||'main')||!direct&&!/^robot\/[A-Za-z0-9_-]{1,90}\/\d{4,}$/.test(pr.head?.ref||''))
  return {ready:false,reason:'not_robot_branch'};
 if(pr.user?.login!==OWNER||!(direct?String(pr.title||'').startsWith('Bubbles direct: '):String(pr.title||'').startsWith('Robot review: ')))
  return {ready:false,reason:'not_owner_robot_pr'};
 const body=String(pr.body||''),sha=String(pr.head?.sha||'');
 if(!/^[a-f0-9]{40}$/.test(sha)||!body.includes('Staged source commit: '+sha)
  ||!body.includes('independent Pink review')||!body.includes('GPT Purple arbitration'))
  return {ready:false,reason:'missing_pinned_bot_evidence'};
 if(!Array.isArray(files)||files.length<1||files.length>12||files.some(f=>f.status!=='modified'&&f.status!=='added'||!safePath(f.filename)))
  return {ready:false,reason:'unsafe_changed_paths'};
 if(!Array.isArray(checks)||checks.length===0||
    !checks.some(c=>c.conclusion==='success')||checks.some(c=>c.status!=='completed'||!['success','skipped','neutral'].includes(c.conclusion)))
  return {ready:false,reason:'checks_not_successful'};
 if(!Array.isArray(statuses)||statuses.some(c=>c.state!=='success'))return {ready:false,reason:'status_not_successful'};
 return {ready:true,reason:'eligible'};
}
async function github(token,route,options={}){
 const resp=await fetch('https://api.github.com/'+route,{method:options.method||'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Infinity-Verified-Robot-Merge'},
  ...(options.body?{body:JSON.stringify(options.body)}:{}),signal:AbortSignal.timeout(20000)});
 const data=await resp.json().catch(()=>({}));
 if(!resp.ok)throw Error('github_http_'+resp.status+' '+route.split('?')[0]);
 return data;
}
export async function runAutoPromotion({token=process.env.REPOSITORY_WRITE_TOKEN||'',maxMerges=4,notifyMerge=receipt=>runnerCall('merge-result',receipt)}={}){
 const report={at:new Date().toISOString(),configured:!!token,scanned:0,merged:[],deferred:[],mode:token?'evaluated':'blocked_missing_writer_credential'};
 if(!token)return report;
 let owned=[];
 try{for(let page=1;page<=20;page++){const rows=await github(token,'user/repos?affiliation=owner&sort=pushed&per_page=100&page='+page);owned.push(...rows.filter(r=>r.owner?.login===OWNER&&!r.archived).map(r=>r.name));if(rows.length<100)break;}}catch(error){report.deferred.push({reason:'owner_inventory_unavailable'});}
 const targets=[...new Set([...TARGETS,...owned])].slice(0,120);
 report.ownerRepositoriesVisible=owned.length;
 for(const name of targets){
  if(report.merged.length>=maxMerges)break;
  let prs;try{prs=await github(token,'repos/'+OWNER+'/'+name+'/pulls?state=open&per_page=30')}catch(e){
   report.deferred.push({repository:name,reason:'pr_listing_unavailable'});continue;
  }
  for(const pr of prs){
   if(report.merged.length>=maxMerges)break;
   if(!/^(?:robot|bubbles)\//.test(pr.head?.ref||''))continue;
   report.scanned++;
   try{
    const route='repos/'+OWNER+'/'+name;
    // Get fresh PR details rather than trusting a stale listing.
    const full=await github(token,route+'/pulls/'+pr.number);
    const [filesResult,checkResult,statusResult]=await Promise.all([
     github(token,route+'/pulls/'+pr.number+'/files?per_page=100'),
     github(token,route+'/commits/'+full.head.sha+'/check-runs?per_page=100'),
     github(token,route+'/commits/'+full.head.sha+'/status')
    ]);
    const verdict=reviewCandidate(full,filesResult,checkResult.check_runs,statusResult.statuses||[]);
    if(!verdict.ready){report.deferred.push({repository:name,pr:pr.number,reason:verdict.reason});continue}
    // A protected branch is never bypassed; GitHub merges only the exact verified HEAD.
    const merged=await github(token,route+'/pulls/'+pr.number+'/merge',{method:'PUT',body:{sha:full.head.sha,merge_method:'squash',
     commit_title:'Verified Infinity robot repair: '+full.title.slice(0,120)}});
    if(!merged.merged||!/^[-a-f0-9]{40}$/.test(merged.sha||''))throw Error('merge_not_confirmed');
    report.merged.push({repository:name,pr:pr.number,head:full.head.sha,mergeSha:merged.sha,url:full.html_url});
    try{await notifyMerge({repository:OWNER+'/'+name,number:pr.number,headSha:full.head.sha});}catch(error){report.deferred.push({repository:name,pr:pr.number,reason:'merge_receipt_pending'});}
   }catch(e){report.deferred.push({repository:name,pr:pr.number,reason:String(e.message||'merge_failed').slice(0,140)})}
  }
 }
 try{
  const pending=await runnerCall('merge-candidates',{});report.reconciled=[];
  for(const job of (pending.candidates||[]).slice(0,8)){
   const prs=await github(token,'repos/'+job.repository+'/commits/'+job.commitSha+'/pulls');
   const merged=prs.find(pr=>pr.merged_at&&pr.head?.sha===job.commitSha);
   if(merged){const receipt=await notifyMerge({repository:job.repository,number:merged.number,headSha:job.commitSha});report.reconciled.push({repository:job.repository,number:merged.number,status:receipt.status});}
  }
 }catch(error){report.reconciliationPending=true;}
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await runAutoPromotion();
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/auto-promotion.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({mode:report.mode,scanned:report.scanned,merged:report.merged,deferred:report.deferred}));
}
