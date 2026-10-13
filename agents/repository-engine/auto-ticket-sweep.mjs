// Convert measured robot inspection failures into deduplicated Oracle Octaves issues.
// Moltnook Issues is disabled; the owner's Oracle Octaves tracker accepts tickets.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const TRACKER='www-infinity4/Oracle-Octaves';
export function deriveTickets(snapshot,{now=Date.now()}={}){
 if(!snapshot||!Array.isArray(snapshot.jobs))throw Error('No verified agent inspection jobs');
 if(!Number.isFinite(Date.parse(snapshot.generatedAt))||Math.abs(now-Date.parse(snapshot.generatedAt))>24*60*60*1000)
  throw Error('Agent inspection snapshot is stale; no tickets created');
 const grouped=new Map();
 for(const j of snapshot.jobs){
  if(!j||!/^[A-Za-z0-9_.-]+$/.test(j.repo||'')||!/^[A-Za-z0-9_.-]+$/.test(j.id||''))continue;
  const missing=(j.checks||[]).filter(c=>c.found===false&&typeof c.path==='string').map(c=>c.path).slice(0,12);
  const category=missing.length?'missing-source-files':j.ci?.status==='failure'?'failed-workflow':null;
  if(!category)continue;
  const key=j.repo+':'+category;
  if(grouped.has(key))continue;
  const sha=/^[a-f0-9]{40}$/.test(j.head?.sha||'')?j.head.sha:null;
  const evidence=category==='failed-workflow'?j.ci?.url:j.head?.url;
  if(typeof evidence!=='string'||!/^https:\/\/github\.com\/www-infinity4\//.test(evidence))continue;
  const title='[Agent Job] '+j.repo+' · '+category;
  const body=[
   'Automated source-evidence ticket; not proof of repair.',
   '',
   'Repository: www-infinity4/'+j.repo,
   'Finding: '+(category==='failed-workflow'?'Last observed workflow concluded failure.':'Required source paths absent at the inspected commit.'),
   'Observed commit: '+(sha||'unavailable'),
   'Workflow name: '+(j.ci?.name||'unavailable'),
   'Missing files: '+(missing.length?missing.map(x=>'\`'+x+'\`').join(', '):'none observed'),
   'Evidence: '+evidence,
   'Inspection: '+(snapshot.runUrl||'unavailable'),
   '',
   'Bot flow: Yellow inspect → Blue plan → Green change only in isolated clone → Pink checks → GPT Purple review → staging PR → independent target CI → merge review.',
   'Acceptance: reproduce this specific failure, propose the smallest fix on robot/*, record checks and commit receipt. Never mark production verified without live evidence.',
   '',
   'Source inspection timestamp: '+snapshot.generatedAt
  ].join('\n');
  grouped.set(key,{title,body,repository:j.repo,category,evidence});
 }
 return [...grouped.values()].slice(0,20);
}
export async function createMissingTickets({tickets,existingTitles,create,maxNew=2}){
 if(!(existingTitles instanceof Set))throw Error('Existing issue names unavailable; fail closed');
 const created=[];
 for(const ticket of tickets){
  if(created.length>=maxNew)break;
  if(existingTitles.has(ticket.title))continue;
  const issue=await create(ticket);
  if(!issue?.html_url||!Number.isInteger(issue.number))throw Error('Ticket API returned no GitHub receipt');
  existingTitles.add(ticket.title);created.push({title:ticket.title,url:issue.html_url,number:issue.number});
 }
 return created;
}
async function github(token,route,options={}){
 const r=await fetch('https://api.github.com/'+route,{method:options.method||'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},
  ...(options.body?{body:JSON.stringify(options.body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('GitHub ticket API failed '+r.status+' at '+route.split('?')[0]);
 return r.json();
}
export async function runTicketSweep({snapshotPath='activity/iterations.json',token=process.env.REPOSITORY_WRITE_TOKEN}={}){
 const snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'));
 const tickets=deriveTickets(snapshot);
 const receipt={timestamp:new Date().toISOString(),tracker:TRACKER,candidates:tickets.length,created:[],mode:token?'ready':'blocked_missing_writer_credential'};
 if(!token)return receipt;
 const existing=new Set();
 for(let page=1;page<=10;page++){
  const rows=await github(token,'repos/'+TRACKER+'/issues?state=all&per_page=100&page='+page);
  for(const row of rows)if(typeof row.title==='string')existing.add(row.title);
  if(rows.length<100)break;
 }
 receipt.created=await createMissingTickets({tickets,existingTitles:existing,maxNew:2,
  create:ticket=>github(token,'repos/'+TRACKER+'/issues',{method:'POST',body:{title:ticket.title,body:ticket.body}})});
 receipt.mode='verified_github_issue_receipts';
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await runTicketSweep();
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/created-brain-tickets.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,created:result.created.map(x=>({title:x.title,url:x.url}))}));
 if(result.mode==='blocked_missing_writer_credential')process.exitCode=1;
}
