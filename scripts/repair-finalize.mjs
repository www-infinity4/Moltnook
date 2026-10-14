// Never execute candidate repository code in the credential-bearing runner.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseTrustedTicket,patchTrustedShopLC} from './repair-draft-dispatch.mjs';
const REPO='www-infinity4/QuantaPhi',API='https://api.github.com/repos/'+REPO;
const BOT='infinity-quantaphi-repair-bot[bot]',SHA=/^[a-f0-9]{40}$/;
export function reviewGate(reviews,head){
 if(!Array.isArray(reviews)||reviews.length>=100)return false;
 const latest=new Map();
 for(const r of reviews){if(['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state))latest.set(r.user?.login,r);}
 if([...latest.values()].some(r=>r.state==='CHANGES_REQUESTED'))return false;
 const owner=latest.get('www-infinity4');
 return owner?.state==='APPROVED'&&owner.commit_id===head;
}
export function checkGate(data,head){
 if(!data||!Array.isArray(data.check_runs)||data.total_count!==data.check_runs.length||data.check_runs.length>=100)return false;
 // This runner also performs its own mandatory browser acceptance before merge.
 return data.check_runs.every(c=>c.head_sha===head&&c.status==='completed'&&['success','neutral','skipped'].includes(c.conclusion));
}
export function validateIdentity(pr,proposal){
 if(pr?.user?.login!==BOT||pr.head?.repo?.full_name!==REPO||pr.base?.repo?.full_name!==REPO||pr.base?.ref!=='main'||pr.head?.ref!==proposal.branch||!SHA.test(pr.head?.sha||'')||pr.head.sha===proposal.baseSha)throw Error('Unexpected repair author, repository, branch or SHA');
}
async function api(suffix,{token,fetchImpl=fetch,method='GET',body}={}){
 const r=await fetchImpl(API+suffix,{method,redirect:'error',headers:{Accept:'application/vnd.github+json','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('GitHub '+r.status+' '+suffix.split('?')[0]);return r.json();
}
async function source(ref,args){
 const f=await api('/contents/index.html?ref='+ref,args);
 if(f.encoding!=='base64'||typeof f.content!=='string')throw Error('Pinned source unavailable');
 return Buffer.from(f.content.replace(/\s/g,''),'base64').toString('utf8');
}
export async function finalize(pr,proposal,{token,fetchImpl=fetch,dryRun=true,browserCheck}={}){
 validateIdentity(pr,proposal);
 const args={token,fetchImpl};
 const original=await source(proposal.baseSha,args),expected=patchTrustedShopLC(original,proposal).content;
 const actual=await source(pr.head.sha,args);
 const diff=await api('/compare/'+proposal.baseSha+'...'+pr.head.sha,args);
 if(actual!==expected||diff.status!=='ahead'||diff.ahead_by!==1||diff.commits?.length!==1||diff.commits[0].sha!==pr.head.sha||diff.commits[0].parents?.length!==1||diff.commits[0].parents[0].sha!==proposal.baseSha||diff.files?.length!==1||diff.files[0].filename!=='index.html'||diff.files[0].status!=='modified')throw Error('Repair exceeds the exact approved patch');
 if(pr.merged_at){
  if(!SHA.test(pr.merge_commit_sha||''))throw Error('Missing merge receipt');
  const merged=await source(pr.merge_commit_sha,args);
  if(merged!==expected)throw Error('Merged source differs from validated repair');
  if(dryRun)return {status:'merged_awaiting_verification',prNumber:pr.number,commitSha:pr.merge_commit_sha};
  if(typeof browserCheck!=='function')throw Error('Deployment browser verifier unavailable');
  const browser=await browserCheck({content:expected,sha:pr.merge_commit_sha,preview:false,prNumber:pr.number});
  return {status:'deployed_verified',prNumber:pr.number,commitSha:pr.merge_commit_sha,browser};
 }
 if(pr.state!=='open')return {status:'closed_unmerged',prNumber:pr.number};
 const branch=await api('/branches/main',args);
 if(branch.protected!==true||branch.commit?.sha!==proposal.baseSha)return {status:'blocked',reason:'Main unprotected or changed; fresh observation required',prNumber:pr.number};
 if(dryRun)return {status:'validated_candidate',prNumber:pr.number,headSha:pr.head.sha};
 if(!token||typeof browserCheck!=='function')throw Error('App token and browser verifier required');
 const browser=await browserCheck({content:expected,sha:pr.head.sha,preview:true,prNumber:pr.number});
 if(pr.draft){
  const r=await fetchImpl('https://api.github.com/graphql',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{number}}}',variables:{id:pr.node_id}}),signal:AbortSignal.timeout(20000)});
  const value=await r.json();if(!r.ok||value.errors||value.data?.markPullRequestReadyForReview?.pullRequest?.number!==pr.number)throw Error('Unable to mark validated draft ready');
 }
 const reviews=await api('/pulls/'+pr.number+'/reviews?per_page=100',args);
 if(!reviewGate(reviews,pr.head.sha))return {status:'waiting_review',prNumber:pr.number,headSha:pr.head.sha,browser};
 // Public checks endpoint needs no extra App permission. Never send the App token.
 const checks=await api('/commits/'+pr.head.sha+'/check-runs?per_page=100',{fetchImpl,token:process.env.REPAIR_READ_TOKEN});
 if(!checkGate(checks,pr.head.sha))return {status:'waiting_checks',prNumber:pr.number,headSha:pr.head.sha};
 const statuses=await api('/commits/'+pr.head.sha+'/status',{fetchImpl,token:process.env.REPAIR_READ_TOKEN});
 if(!Array.isArray(statuses.statuses)||statuses.total_count!==statuses.statuses.length||(statuses.total_count>0&&statuses.state!=='success'))return {status:'waiting_checks',prNumber:pr.number,headSha:pr.head.sha};
 const latest=await api('/pulls/'+pr.number,args),main=await api('/branches/main',args);
 validateIdentity(latest,proposal);
 if(latest.head.sha!==pr.head.sha||latest.state!=='open'||latest.draft||latest.mergeable!==true||main.protected!==true||main.commit?.sha!==proposal.baseSha)return {status:'blocked',reason:'PR or main changed before merge',prNumber:pr.number};
 const result=await api('/pulls/'+pr.number+'/merge',{...args,method:'PUT',body:{sha:pr.head.sha,merge_method:'merge'}});
 if(result.merged!==true||!SHA.test(result.sha||''))throw Error('GitHub did not confirm merge');
 try{
  if(await source(result.sha,args)!==expected)throw Error('Merge source mismatch');
  const deployed=await browserCheck({content:expected,sha:result.sha,preview:false,prNumber:pr.number});
  return {status:'deployed_verified',prNumber:pr.number,commitSha:result.sha,browser:deployed};
 }catch(e){return {status:'merged_unverified',prNumber:pr.number,commitSha:result.sha,reason:e.message};}
}
export async function scanRepairPulls({token,fetchImpl=fetch,maxPages=20}={}){
 const rows=[],seen=new Set();
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw Error('Invalid PR scan page bound');
 for(let page=1;page<=maxPages;page++){
  const batch=await api('/pulls?state=all&sort=updated&direction=desc&per_page=100&page='+page,{token,fetchImpl});
  if(!Array.isArray(batch)||batch.length>100)throw Error('Invalid PR scan response');
  for(const row of batch){
   if(!Number.isInteger(row?.number)||row.number<1)throw Error('Invalid PR scan identity');
   // Updated-at ordering can move rows across pages during a scan. Never trust
   // an incomplete snapshot: retry next run instead of silently missing work.
   if(seen.has(row.number))throw Error('PR scan changed during pagination; retry intake');
   seen.add(row.number);rows.push(row);
  }
  if(batch.length<100)return rows;
 }
 throw Error('PR scan incomplete; page bound reached');
}

export async function main(){
 const apply=process.argv.includes('--apply'),token=apply?process.env.REPAIR_APP_TOKEN:process.env.REPAIR_READ_TOKEN;
 const receipt={schemaVersion:1,checkedAt:new Date().toISOString(),mode:apply?'apply':'dry_run',status:'idle',results:[]};
 await fs.mkdir('repository-receipts',{recursive:true});
 try{
  if(apply&&!token)throw Error('Repository-scoped App token missing');
  const pulls=await scanRepairPulls({token});
  const {browserCheck}=await import('./repair-finalize-browser.mjs');
  for(const row of pulls.filter(p=>p.user?.login===BOT&&/^repair\/browser-[a-f0-9]{24}$/.test(p.head?.ref||'')).sort((a,b)=>(a.state==='open'?0:1)-(b.state==='open'?0:1)).slice(0,10)){
   try{
    const match=/Intake ticket: https:\/\/github\.com\/www-infinity4\/Oracle-Octaves\/issues\/([1-9][0-9]*)\b/.exec(row.body||'');
    if(!match)throw Error('Missing immutable intake reference');
    const r=await fetch('https://api.github.com/repos/www-infinity4/Oracle-Octaves/issues/'+match[1],{headers:process.env.REPAIR_READ_TOKEN?{Authorization:'Bearer '+process.env.REPAIR_READ_TOKEN}:{},redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error('Intake unavailable');const proposal=parseTrustedTicket(await r.json());
    if(!proposal)throw Error('Intake no longer validates');
    const pr=await api('/pulls/'+row.number,{token});
    const result=await finalize(pr,proposal,{token,dryRun:!apply,browserCheck:apply?browserCheck:undefined});receipt.results.push(result);
    // Bound each run to at most one eligible repair.
    break;
   }catch(e){receipt.results.push({status:row.merged_at?'merged_unverified':'blocked',prNumber:row.number,reason:String(e.message).slice(0,220)});}
  }
  if(receipt.results.length)receipt.status=receipt.results.at(-1).status;
  else if(apply){
   const branch=await api('/branches/main',{token});
   if(branch.protected!==true||!SHA.test(branch.commit?.sha||''))throw Error('Protected main required for live smoke check');
   const content=await source(branch.commit.sha,{token});
   receipt.liveSmoke=await browserCheck({content,sha:branch.commit.sha,preview:false,prNumber:'main'});
   receipt.status='live_smoke_passed';
  }
 }catch(e){receipt.status='blocked';receipt.error=String(e.message).slice(0,220);process.exitCode=1;}
 if(['blocked','merged_unverified'].includes(receipt.status))process.exitCode=1;
 await fs.writeFile('repository-receipts/repair-finalize.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
