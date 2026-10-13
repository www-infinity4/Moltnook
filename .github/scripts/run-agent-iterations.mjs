/* Source-verified, repeatable Phi job sweeper.
   This is GitHub Actions work: API reads, executable checks and durable
   receipts. A scan is NEVER labeled an autonomous code repair. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {routeEvent} from './agent-routing.mjs';
import {spawnColorChild,selectChildRoles,inspectChild,parentReport,responsibilitiesFor,READ_ONLY_TOOLS} from '../../agents/color-child-bots.mjs';
const input=JSON.parse(await fs.readFile('agents/jobs.json','utf8'));
if(!Array.isArray(input.jobs)||!input.jobs.length)throw Error('Empty agent job registry');
const headers={'Accept':'application/vnd.github+json','User-Agent':'moltnook-infinity-iteration/2.0',
 ...(process.env.GITHUB_TOKEN?{Authorization:'Bearer '+process.env.GITHUB_TOKEN}:{})};
const owner='www-infinity4';
const link=(repo,suffix='')=>'https://github.com/'+owner+'/'+repo+suffix;
const time=new Date().toISOString();
const runUrl=process.env.GITHUB_RUN_ID?link('Moltnook','/actions/runs/'+process.env.GITHUB_RUN_ID):null;
async function request(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
   const res=await fetch(url,{headers,signal:controller.signal});
   if(res.status===404)return {ok:false,status:404};
   if(!res.ok)throw Error('GitHub '+res.status);
   return {ok:true,value:await res.json()};
 }finally{clearTimeout(timer)}
}
const repos=[...new Set(input.jobs.map(x=>x.repo))];
const evidence=new Map(),failed=[];
for(const repo of repos){
 const base='https://api.github.com/repos/'+owner+'/'+encodeURIComponent(repo);
 try{
  const [commits,runs,readme]=await Promise.all([
   request(base+'/commits?per_page=1'),
   request(base+'/actions/runs?per_page=8'),
   request(base+'/readme')
  ]);
  const mission=readme.ok&&readme.value?.content?
    Buffer.from(readme.value.content,'base64').toString('utf8').slice(0,40000):'';
  const missionTitle=(mission.match(/^#\s+(.+)$/m)?.[1]||'README title unavailable').slice(0,130);
  const commit=commits.value?.[0],actions=runs.value?.workflow_runs||[];
  evidence.set(repo,{base,mission:mission?{title:missionTitle,url:link(repo,'/blob/main/README.md')}:null,commit:commit?.sha?{sha:commit.sha,
    when:commit.commit?.committer?.date||commit.commit?.author?.date,
    title:commit.commit?.message?.split('\n')[0]||'Commit',
    url:commit.html_url}:null,
    action:actions.find(x=>x.status==='completed')&&{
      status:actions.find(x=>x.status==='completed').conclusion,
      when:actions.find(x=>x.status==='completed').updated_at,
      url:actions.find(x=>x.status==='completed').html_url,
      name:actions.find(x=>x.status==='completed').name}});
 }catch(error){failed.push(repo+': '+String(error.message||error).slice(0,140))}
}
let previous={};
try{previous=JSON.parse(await fs.readFile('activity/iterations.json','utf8'))}catch{}
const messages=[...(previous.messages||[])],jobRows=[];
const agents=[...(previous.agents||[])];
const roster=JSON.parse(await fs.readFile('agents/roster.json','utf8'));
const names={yellow:'Golden Quill',blue:'Blue Comet',orange:'Orange Spark',green:'Green Sprout',pink:'Pink Lynx',purple:'Purple Prism'};
function spawn(job){
 let specialist=agents.find(a=>a.jobId===job.id);
 if(!specialist && agents.length<120){
  const parent=roster.find(a=>a.id===job.agent)||roster.find(a=>a.id==='greenbeans');
  specialist={...parent,id:'specialist-'+job.id.toLowerCase().replace(/[^a-z0-9-]/g,'-'),
   name:(names[parent.color]||'Phi Scout')+' · '+job.id,jobId:job.id,parent:parent.id,
   job:job.title,createdAt:time,permissions:['read public repository','write Moltnook evidence'],
   tools:[...READ_ONLY_TOOLS],depth:1,status:'assigned'};
  agents.push(specialist);
 }
 return specialist;
}
const seen=new Set(messages.map(m=>m.id));
const say=(job,agent,to,phase,message,url,kind='inspection')=>{
 if(!url||!url.startsWith('https://github.com/'))return;
 const id=job.id+':'+agent+':'+phase+':'+url+':'+message;
 if(seen.has(id))return;seen.add(id);
 messages.push({id,jobId:job.id,
 agent,to,project:job.repo,kind,phase,when:time,url,message});
};
const ordered=[...input.jobs].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
for(const job of ordered){
 const specialist=spawn(job);
 const repo=evidence.get(job.repo),head=repo?.commit;
 const checks=[];
 if(repo){
   const paths=[...new Set(job.checkPaths||[])].slice(0,6);
   for(const file of paths){
    const result=await request(repo.base+'/contents/'+file.split('/').map(encodeURIComponent).join('/')).catch(e=>({ok:false,error:String(e.message||e)}));
    checks.push({path:file,found:!!result.ok,url:link(job.repo,'/blob/main/'+file),error:result.error||null});
   }
 }
 const found=checks.filter(c=>c.found).length;
 // Existing color desk chooses bounded child roles. Each child is a real scoped
 // GitHub evidence inspection performed by this runner, not a new model process.
 const delegations=[];
 if(specialist){
   for(const roleId of selectChildRoles(specialist,roster)){
     const role=roster.find(a=>a.id===roleId),[task,completion]=responsibilitiesFor(role.color);
     try{
       const {agent}=spawnColorChild({agents,roster,parentId:specialist.id,job,roleId,task,completion,now:time});
       const updated=inspectChild({child:agent,job,head,mission:repo?.mission,checks,ci:repo?.action,now:time});
       agents[agents.findIndex(a=>a.id===agent.id)]=updated;
       delegations.push({id:updated.id,parentId:updated.parentId,roleId:updated.roleId,color:updated.color,
         task:updated.task,completion:updated.completion,status:updated.status,
         receipt:updated.receipt});
     }catch(error){failed.push('Child delegation '+job.id+'/'+roleId+': '+String(error.message||error).slice(0,150))}
   }
 }
 const childSummary=specialist?parentReport(agents,specialist.id):null;
 const scan=head?'scanned':'unavailable';
 const blocked=!head||found<checks.length||repo?.action?.status==='failure';
 const status=blocked?'needs_work':'scanned';
 jobRows.push({id:job.id,priority:job.priority,title:job.title,repo:job.repo,
   agent:job.agent,next:job.next,status,source:job.source,sourceUrl:job.sourceUrl,mission:repo?.mission||null,
   checkedAt:time,head,ci:repo?.action||null,checks,delegations,childSummary,
   execution:'delegated read-only GitHub inspections only: child bots did not edit source or deploy'});
 if(!head)continue;
 say(job,'bluth',job.agent,'Prioritized','Priority '+job.priority+
   ' · Assigned: '+job.title+' · Owner-requested queue; no automatic completion claim.',link(job.repo), 'routing');
 if(repo.mission) say(job,'gold-diggers-ink',job.agent,'Mission read',
   'Read the current project README: '+repo.mission.title+'. Keep the owner priority and existing project purpose intact.',repo.mission.url,'readme');
 say(job,specialist?.id||job.agent,job.next,'Inspected','Checked '+found+'/'+checks.length+
   ' expected files in '+job.repo+' at '+head.sha.slice(0,9)+'. Latest commit: '+head.title+
   (checks.some(c=>!c.found)?'. Missing: '+checks.filter(c=>!c.found).map(c=>c.path).join(', '):'.'),
   head.url,'read');
 if(repo.action){
   say(job,'pink-panther','purple-pearl',repo.action.status==='success'?'CI observed':'Needs review',
     'GitHub workflow '+repo.action.name+' finished '+repo.action.status+
     '. A green run alone does not establish that the reported owner issue is repaired.',
     repo.action.url,'test');
 }
 say(job,'purple-pearl','greenbeans',status==='scanned'?'Work queued':'Needs work',
   'Human update: '+job.title+'. The latest source was inspected; any code repair requires an authenticated, scoped writer and its own test/commit evidence.',
   head.url,'report');
}
// Read enabled issue tracker for new requests (not private ChatGPT/Gemini conversations).
let discovered=0;
try{
 const issues=await request('https://api.github.com/repos/'+owner+'/Oracle-Octaves/issues?state=open&sort=updated&per_page=30');
 for(const issue of issues.value||[]){
  if(issue.pull_request||!/^\[Agent Job\]/i.test(issue.title||''))continue;
  const route=routeEvent({id:'intake-'+issue.number,title:issue.title,
    project:'Oracle-Octaves',kind:'issue',when:issue.updated_at,url:issue.html_url});
  const intakeId='issue-'+issue.number+':'+issue.updated_at;
  if(!seen.has(intakeId))messages.push({...route,id:intakeId,phase:'Owner issue routed',jobId:'ORACLE-'+issue.number});
  discovered++;
 }
}catch(error){failed.push('Oracle issue intake: '+String(error.message||error))}
const output={schemaVersion:2,generatedAt:time,source:'Live GitHub API + owner-authored agents/jobs.json',
 runUrl,mode:'bounded color-parent delegation + authenticated GitHub read / Moltnook evidence writing only',
 claim:'Actual source inspections, route decisions and workflow checks. No model code edits are implied.',
 agents,jobs:jobRows,discoveredIssues:discovered,failures:failed,
 messages:messages.slice(-160)};
const dest=path.resolve('activity/iterations.json');
await fs.mkdir(path.dirname(dest),{recursive:true});
await fs.writeFile(dest,JSON.stringify(output,null,2)+'\n');
console.log('Checked '+jobRows.length+' prioritized jobs in '+repos.length+
  ' repos; '+messages.length+' sourced events; '+failed.length+' source errors.');
if(!jobRows.some(x=>x.head))throw Error('No repository source confirmed');
