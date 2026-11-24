// GitHub Actions workflow watcher, continuing QuantaPhi #1907.
// Existing Oracle Octaves issue is the repair handoff; no autonomous merge.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const TRACKER='www-infinity4/Oracle-Octaves';
// The verified five-minute scope is Moltnook and QuantaPhi. Expand only after
// a separately evidenced repository-permission and workflow inventory check.
const REPOS=['Moltnook','QuantaPhi'];
const IGNORE=new Set(['robot-brain-auto-tickets.yml','workflow-watch.yml']);
const AGE_MS=86400000;
const SAFE_SHA=/^[a-f0-9]{40}$/;
const validAttempt=value=>Number.isSafeInteger(value)&&value>0;
const marker=f=>'<!-- workflow-watch:'+f.repo+':'+f.run_id+':'+f.run_attempt+' -->';
const legacyMarker=f=>'<!-- workflow-watch:'+f.repo+':'+f.run_id+' -->';
const SAFE_WORKFLOW=/^\.github\/workflows\/[\w.-]+\.ya?ml$/;
export function selectLatestFailures(repo,runs,{now=Date.now(),max=12}={}){
  if(!REPOS.includes(repo)||!Array.isArray(runs))throw Error('Unexpected workflow inventory');
  const seen=new Set(),out=[];
  for(const r of [...runs].sort((a,b)=>Date.parse(b?.created_at)-Date.parse(a?.created_at)||
    (Number.isSafeInteger(b?.id)?b.id:0)-(Number.isSafeInteger(a?.id)?a.id:0)||
    (validAttempt(b?.run_attempt)?b.run_attempt:0)-(validAttempt(a?.run_attempt)?a.run_attempt:0))){
    if(!r||!SAFE_WORKFLOW.test(r.path||'')||typeof r.head_branch!=='string'||!r.head_branch||r.head_branch.length>140)continue;
    if(IGNORE.has(r.path.split('/').at(-1)))continue;
    const key=r.path+'@'+r.head_branch;
    if(seen.has(key))continue;
    seen.add(key);
    const age=now-Date.parse(r.created_at);
    if(!(age>=0&&age<=AGE_MS)||r.status!=='completed'||r.conclusion!=='failure'||!SAFE_SHA.test(r.head_sha||''))continue;
    const expected='https://github.com/www-infinity4/'+repo+'/actions/runs/'+r.id;
    if(!Number.isSafeInteger(r.id)||r.id<=0||!validAttempt(r.run_attempt)||r.html_url!==expected)continue;
    out.push({repo,workflow:r.path,branch:r.head_branch,sha:r.head_sha,run_id:r.id,run_attempt:r.run_attempt,run_url:expected,job_failures:[]});
    if(out.length>=max)break;
  }
  return out;
}
// GitHub Actions job and step labels are repository-authored data, not
// instructions to the repair agent. Drop extra lines, markdown directives,
// and recognizable credentials before copying labels into issue tickets.
function safeLabel(value,max=140){
  const first=String(value??'unknown').split(/\r|\n|\\r|\\n/)[0];
  const redacted=first
    .replace(/(?:github_pat_[A-Za-z0-9_]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,})/g,'redacted')
    .replace(/((?:api[_-]?key|password|secret|token)\s*[:=]\s*)["']?[^\s"',;]+/gi,'$1redacted')
    .replace(/[^A-Za-z0-9 .,;:()/_-]/g,' ')
    .replace(/\s+/g,' ').trim();
  return redacted.slice(0,max)||'unknown';
}
function safeJobUrl(f,url){
  const expected='https://github.com/www-infinity4/'+f.repo+'/actions/runs/'+f.run_id+'/job/';
  return typeof url==='string'&&url.startsWith(expected)&&/^[1-9][0-9]*$/.test(url.slice(expected.length));
}
export function buildReceipt(f){
  const jobs=(f.job_failures||[]).filter(j=>safeJobUrl(f,j?.url)).slice(0,4)
    .map(j=>'- '+safeLabel(j.name)+': '+j.url+'; failed step: '+safeLabel(j.step)).join('\n');
  return [
    marker(f),
    '**New verified CI failure. Not repaired.**',
    'Repository: www-infinity4/'+f.repo,
    'Workflow: '+safeLabel(f.workflow)+'; branch: '+safeLabel(f.branch),
    'Exact head: '+f.sha,
    'Run evidence: '+f.run_url+'; Attempt: '+f.run_attempt,
    jobs||'Failed job details unavailable (inspect run before repair).',
    'Repair: Red reproduces at this SHA, Green patches through existing signed owner repository engine, Pink tests exact-head CI; independent security review and permitted merge; separate deployment verification.',
    'Do not bypass existing branch, reviewer, network-isolation or owner scope gates.'
  ].join('\n');
}
export function planTicketChanges(findings,issues){
  if(!Array.isArray(findings)||!Array.isArray(issues))throw Error('Ticket evidence unavailable');
  const grouped=new Map();
  for(const f of findings){
    if(!REPOS.includes(f.repo)||!validAttempt(f.run_attempt))continue;
    const arr=grouped.get(f.repo)||[];
    if(arr.length<4)arr.push(f);
    grouped.set(f.repo,arr);
  }
  const result=[];
  for(const [repo,items] of grouped){
    const title='[Agent Job] '+repo+' · failed-workflow';
    const existing=issues.find(issue=>issue.title===title&&Number.isInteger(issue.number));
    const original=existing?.body||'';
    // Old run-only markers can cover the first attempt, never suppress a rerun.
    const seen=new Set();
    const news=items.filter(f=>{const key=marker(f);if(seen.has(key)||original.includes(key)||(f.run_attempt===1&&original.includes(legacyMarker(f))))return false;seen.add(key);return true;});
    if(!news.length)continue;
    const body=[original||'Evidence-backed recurring GitHub Actions failure tracker. Not proof of repair.',...news.map(buildReceipt)].join('\n\n---\n\n');
    if(body.length>60000)continue;
    result.push(existing?{kind:'update',number:existing.number,title,body}:{kind:'create',title,body});
  }
  return result;
}
async function gh(token,route,{method='GET',body}={}){
  const response=await fetch('https://api.github.com/'+route,{
    method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Error('GitHub '+response.status+' at '+route.split('?')[0]);
  return response.json();
}
export async function runWatch({token=process.env.REPOSITORY_WRITE_TOKEN,api=gh,now=Date.now()}={}){
  const report={checkedAt:new Date(now).toISOString(),repositories:REPOS,findings:[],ticket_changes:[],state:'no_failures',source:'live_github_actions'};
  if(!token){report.state='blocked_missing_owner_credential';return report;}
  const all=[];
  for(const repo of REPOS){
    const runs=[];
    for(let page=1;page<=2;page++){
      const result=await api(token,'repos/www-infinity4/'+repo+'/actions/runs?per_page=100&page='+page);
      if(!Array.isArray(result.workflow_runs))throw Error('Actions inventory missing for '+repo);
      runs.push(...result.workflow_runs);
      if(result.workflow_runs.length<100)break;
    }
    for(const f of selectLatestFailures(repo,runs,{now,max:6})){
      try{
        const detail=await api(token,'repos/www-infinity4/'+repo+'/actions/runs/'+f.run_id+'/attempts/'+f.run_attempt+'/jobs?per_page=100');
        if(!Array.isArray(detail.jobs))throw Error('Actions jobs inventory missing');
        f.job_failures=detail.jobs.filter(j=>j?.conclusion==='failure'&&j.run_attempt===f.run_attempt&&Number.isSafeInteger(j.id)&&j.id>0)
          .slice(0,4).map(j=>({
            // The persisted artifact is also shared evidence: sanitize BEFORE storage.
            name:safeLabel(j.name,120),
            url:'https://github.com/www-infinity4/'+repo+'/actions/runs/'+f.run_id+'/job/'+j.id,
            step:safeLabel(Array.isArray(j.steps)?j.steps.find(s=>s?.conclusion==='failure')?.name:'unknown',160)
          }));
      }catch{f.job_failures=[];}
      all.push(f);
    }
  }
  report.findings=all;
  if(!all.length)return report;
  const issues=[];
  for(let page=1;page<=5;page++){
    const rows=await api(token,'repos/'+TRACKER+'/issues?state=all&per_page=100&page='+page);
    if(!Array.isArray(rows))throw Error('Issue inventory unavailable');
    issues.push(...rows);
    if(rows.length<100)break;
  }
  const planned=planTicketChanges(all,issues);
  for(const item of planned){
    const result=item.kind==='create'
      ?await api(token,'repos/'+TRACKER+'/issues',{method:'POST',body:{title:item.title,body:item.body}})
      :await api(token,'repos/'+TRACKER+'/issues/'+item.number,{method:'PATCH',body:{body:item.body,state:'open'}});
    if(!Number.isInteger(result.number)||typeof result.html_url!=='string'||!result.html_url.startsWith('https://github.com/'+TRACKER+'/issues/'))throw Error('Ticket write returned no GitHub receipt');
    report.ticket_changes.push({kind:item.kind,url:result.html_url,number:result.number});
  }
  report.state=planned.length?'tracked_verified_failures':'failures_already_tracked';
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const report=await runWatch();
    await fs.mkdir('repository-receipts',{recursive:true});
    await fs.writeFile('repository-receipts/workflow-watch.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify({state:report.state,findings:report.findings.length,tickets:report.ticket_changes}));
    if(report.state==='blocked_missing_owner_credential')process.exitCode=1;
  }catch(error){
    await fs.mkdir('repository-receipts',{recursive:true});
    await fs.writeFile('repository-receipts/workflow-watch.json',JSON.stringify({state:'blocked',error:String(error.message).slice(0,250)},null,2));
    console.error('Workflow watch blocked:',error.message);process.exitCode=1;
  }
}
