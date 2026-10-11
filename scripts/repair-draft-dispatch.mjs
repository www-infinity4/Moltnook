// Least-privilege consumer for PR #23 browser-repair issues.
// No arbitrary regex suggestions, shell commands, direct main writes or deployments.
// Initial production scope: one immutable, source-proven ShopLC link repair.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ISSUE_API='https://api.github.com/repos/www-infinity4/Oracle-Octaves/issues';
const TARGET='www-infinity4/QuantaPhi';
const API='https://api.github.com/repos/'+TARGET;
const CANONICAL='https://quantaphi.org/';
const EXPECTED='https://quantaphi.org/shoplc/';
const SOURCE='index.html';
const CONTROL='shoplcShirtButton';
const SHA=/^[a-f0-9]{40}$/;
const ID=/^browser-repair-[a-f0-9]{24}$/;
const RUN=/^https:\/\/github\.com\/www-infinity4\/Moltnook\/actions\/runs\/[0-9]+$/;
const CODE_FENCE=new RegExp('\\x60{3}json\\s*([\\s\\S]*?)\\s*\\x60{3}','i');

function sameURL(input){
 try{
  if(typeof input!=='string'||!input||input.length>350)return '';
  const u=new URL(input,CANONICAL);
  if(u.origin!=='https://quantaphi.org'||u.username||u.password||u.hash)return '';
  return u.href;
 }catch{return ''}
}
export function parseTrustedTicket(issue){
 if(!issue||!Number.isInteger(issue.number)||issue.number<1||issue.pull_request||!String(issue.title||'').startsWith('[Agent Job] Browser repair ')||typeof issue.body!=='string'||issue.body.length>40000)return null;
 const match=CODE_FENCE.exec(issue.body);
 if(!match)return null;
 let ticket;try{ticket=JSON.parse(match[1])}catch{return null}
 if(!ticket||ticket.schemaVersion!==1||!ID.test(ticket.id)||!issue.body.includes('<!-- '+ticket.id+' -->')||ticket.task!=='INSPECT_BROKEN_CONTROL')return null;
 const f=ticket.failureDetails||{},lookup=ticket.sourceLookup||{};
 if(f.repository!==TARGET||f.selector!=='#'+CONTROL||!['mobile','desktop'].includes(f.device)||sameURL(f.expectedHref)!==EXPECTED||sameURL(f.actualHref)===EXPECTED||!sameURL(f.actualHref))return null;
 if(lookup.status!=='unique_candidate'||!SHA.test(lookup.baseSha)||!Array.isArray(lookup.matches)||lookup.matches.length!==1||lookup.matches[0].path!==SOURCE)return null;
 if(!RUN.test(ticket.evidence?.runUrl||''))return null;
 return {issueNumber:issue.number,issueURL:String(issue.html_url||''),ticket,baseSha:lookup.baseSha,
  branch:'repair/browser-'+ticket.id.slice('browser-repair-'.length)};
}
export function patchTrustedShopLC(original,proposal){
 if(typeof original!=='string'||original.length>1000000||!proposal?.ticket)throw Error('Source missing or exceeds bound');
 const observed=sameURL(proposal.ticket.failureDetails.actualHref);
 if(!observed||observed===EXPECTED)throw Error('Observation is not an eligible wrong href');
 const anchors=[...original.matchAll(/<a\b[^>]{0,3000}>/gi)].filter(x=>/(?:^|\s)id\s*=\s*(["'])shoplcShirtButton\1/.test(x[0]));
 if(anchors.length!==1)throw Error('Selector must occur on exactly one static anchor');
 const tag=anchors[0][0],href=/(?:^|\s)href\s*=\s*(["'])([^"']*)\1/i.exec(tag);
 if(!href)throw Error('Anchor href unavailable');
 const sourceURL=sameURL(href[2]);
 if(sourceURL===EXPECTED)throw Error('Pinned source already has desired href: live behavior needs investigation');
 if(sourceURL!==observed)throw Error('Observed href and pinned source disagree: cannot infer safe repair');
 if(tag.includes('$'+'{')||/\bon[a-z]+\s*=/.test(tag))throw Error('Dynamic or event-handler markup requires human review');
 let replacement=tag.replace(href[0],href[0].replace(href[2],EXPECTED));
 const siteUrl=/(?:^|\s)data-site-url\s*=\s*(["'])([^"']*)\1/i.exec(replacement);
 if(siteUrl){
  if(!sameURL(siteUrl[2]))throw Error('Unsafe data-site-url in pinned markup');
  replacement=replacement.replace(siteUrl[0],siteUrl[0].replace(siteUrl[2],EXPECTED));
 }
 if(replacement===tag)throw Error('No source correction');
 const fixed=original.slice(0,anchors[0].index)+replacement+original.slice(anchors[0].index+tag.length);
 if(!fixed.includes('id="'+CONTROL+'"')&&!fixed.includes("id='"+CONTROL+"'"))throw Error('Control missing after replacement');
 return {content:fixed,from:sourceURL,to:EXPECTED,path:SOURCE,selector:'#'+CONTROL};
}
async function github(url,{token,fetchImpl=fetch,...options}={}){
 if(!url.startsWith('https://api.github.com/repos/www-infinity4/'))throw Error('Untrusted GitHub API destination');
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/vnd.github+json','Content-Type':'application/json',
  ...(token?{Authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('GitHub API '+response.status+' for '+new URL(url).pathname);
 return response.json();
}
export async function findRepairIssues({fetchImpl=fetch}={}){
 const issues=await github(ISSUE_API+'?state=open&per_page=100',{fetchImpl});
 if(!Array.isArray(issues))throw Error('Issue intake response invalid');
 return issues.map(parseTrustedTicket).filter(Boolean).sort((a,b)=>a.issueNumber-b.issueNumber).slice(0,20);
}
export async function dispatchDraftRepair(proposal,{token,fetchImpl=fetch,dryRun=false}={}){
 if(!proposal||!ID.test(proposal.ticket?.id||''))throw Error('Validated ticket required');
 if(!dryRun&&(!token||token.length<15))return {status:'blocked',reason:'Repository-scoped GitHub App token unavailable',issue:proposal.issueNumber};
 const args={token:dryRun?null:token,fetchImpl};
 const ref=await github(API+'/git/ref/heads/main',args);
 const head=ref?.object?.sha;
 if(!SHA.test(head||'')||head!==proposal.baseSha)return {status:'blocked',reason:'Pinned source SHA no longer equals main; reobserve before repair',issue:proposal.issueNumber};
 const file=await github(API+'/contents/'+SOURCE+'?ref='+head,args);
 if(typeof file?.content!=='string'||!file.sha||file.encoding!=='base64')throw Error('Pinned GitHub source unavailable');
 const original=Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8');
 let patch;
 try{patch=patchTrustedShopLC(original,proposal)}catch(e){return {status:'blocked',reason:String(e.message).slice(0,160),issue:proposal.issueNumber}}
 const prList=await github(API+'/pulls?state=all&head=www-infinity4:'+encodeURIComponent(proposal.branch)+'&per_page=10',args);
 if(!Array.isArray(prList))throw Error('Existing PR response invalid');
 if(prList.length)return {status:'existing_draft_or_pr',issue:proposal.issueNumber,prURL:prList[0].html_url,branch:proposal.branch};
 if(dryRun)return {status:'dry_run_candidate',issue:proposal.issueNumber,branch:proposal.branch,path:SOURCE,from:patch.from,to:patch.to,baseSha:head,
  note:'No branches, commits, issues or pull requests changed'};
 const body='Read-only observed control mismatch, anchored to '+proposal.ticket.evidence.runUrl+
  '\nIntake ticket: '+proposal.issueURL+'\n\nRepair limited to '+SOURCE+' #'+CONTROL+
  ' from '+patch.from+' to '+patch.to+'. Browser and source evidence refer to pinned SHA '+head+
  '.\n\n**Draft only.** Review before merging. No wallet, auth, database, workflow or deployment changes. A fresh browser run and focused tests are required before completion.';
 await github(API+'/git/refs',{...args,method:'POST',body:JSON.stringify({ref:'refs/heads/'+proposal.branch,sha:head})});
 await github(API+'/contents/'+SOURCE,{...args,method:'PUT',body:JSON.stringify({message:'repair: restore ShopLC source href from verified browser receipt',
   content:Buffer.from(patch.content,'utf8').toString('base64'),sha:file.sha,branch:proposal.branch})});
 const pr=await github(API+'/pulls',{...args,method:'POST',body:JSON.stringify({title:'Draft: repair ShopLC href from browser receipt '+proposal.ticket.id.slice(-8),
  head:proposal.branch,base:'main',draft:true,body,maintainer_can_modify:true})});
 if(!pr?.html_url||!pr?.number)throw Error('GitHub omitted durable draft PR receipt; inspect created branch');
 return {status:'draft_pr_created',issue:proposal.issueNumber,prNumber:pr.number,prURL:pr.html_url,branch:proposal.branch,baseSha:head,
  deploymentVerified:false,walletChanged:false};
}
export async function main(args=process.argv.slice(2)){
 const apply=args.includes('--apply'),dir='repository-receipts';
 let receipt={schemaVersion:1,status:'no_matching_tickets',mode:apply?'apply':'dry_run',checkedAt:new Date().toISOString(),results:[]};
 try{
  const tickets=await findRepairIssues();
  receipt.matchingTickets=tickets.length;
  // At most one source-changing PR per run. Other tickets stay intact.
  for(const ticket of tickets){
   const row=await dispatchDraftRepair(ticket,{token:process.env.REPAIR_APP_TOKEN||'',dryRun:!apply});
   receipt.results.push(row);
   receipt.status=row.status;
   if(row.status==='draft_pr_created'||row.status==='dry_run_candidate'||row.status==='existing_draft_or_pr')break;
  }
 }catch(e){receipt.status='blocked';receipt.error=String(e.message||e).slice(0,220);process.exitCode=1}
 await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(dir,'repair-draft-dispatch.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt));
 if(apply&&receipt.status==='blocked')process.exitCode=1;
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
