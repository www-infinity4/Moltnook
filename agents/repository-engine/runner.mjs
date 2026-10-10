import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {applyEdits,safePath,inside} from './patch.mjs';
import {captureSourceViews} from './preview.mjs';
import {repairWithFeedback} from './repair-feedback.mjs';
import {inspectRuntime,focusedTestCommand} from './runtime-baseline.mjs';
import {observeLiveSource} from './live-source.mjs';
import {executionContext} from './execution-context.mjs';
const API='https://infinity-brain-clock.marvaseater.workers.dev',OWNER='www-infinity4';
const token=process.env.REPOSITORY_WRITE_TOKEN||'';
const report={schemaVersion:1,when:new Date().toISOString(),status:'starting',events:[],credentials:{configured:!!token,valuesExposed:false}};
let lease,workspace,commitSha,testsPassed=false;
const cleanEnv={PATH:process.env.PATH,HOME:process.env.HOME,CI:'true',LANG:'C.UTF-8'};
const credentialEnv=()=>({...cleanEnv,GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_1:'core.hooksPath',GIT_CONFIG_VALUE_1:'/dev/null',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:'AUTHORIZATION: basic '+Buffer.from('x-access-token:'+token).toString('base64')});
const command=(cmd,args,options={})=>execFileSync(cmd,args,{cwd:workspace,encoding:'utf8',timeout:180000,maxBuffer:3*1024*1024,env:cleanEnv,...options});
const git=(...args)=>command('git',args).trim();
function scrub(value){return String(value).replaceAll(token||'__NO_TOKEN__','[redacted]').slice(-9000);}
async function github(resource){const r=await fetch('https://api.github.com/'+resource,{headers:{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GitHub '+r.status+' at '+resource.split('?')[0]);return r.json();}
async function call(step,body={}){
 const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);identityUrl.searchParams.set('audience','infinity-brain-writer');
 const response=await fetch(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Runner identity unavailable');const {value}=await response.json();
 const r=await fetch(API+'/runner/'+step,{method:'POST',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({...body,key:lease?.key,leaseId:lease?.leaseId}),signal:AbortSignal.timeout(180000)});
 const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'Robot brain HTTP '+r.status);return result;
}
async function event(agent,message){const row={agent,message,when:new Date().toISOString()};report.events.push(row);await call('event',row);}
async function sourceFile(file){safePath(file);const absolute=inside(workspace,file);try{
 const parts=file.split('/');let current=workspace;for(const part of parts){current=path.join(current,part);const st=await fs.lstat(current);if(st.isSymbolicLink())throw Error('Writer refuses symlink source');}
 const s=await fs.readFile(absolute,'utf8');if(Buffer.byteLength(s)>180000)throw Error('Source requires a smaller task: '+file);return s;
 }catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function checks(patched){
 const runs=[];const run=(name,cmd,args)=>{try{const output=command(cmd,args);runs.push({name,passed:true,output:scrub(output)});}catch(e){runs.push({name,passed:false,output:scrub(e.stdout||e.stderr||e.message)});report.tests={passed:false,runs};throw Error('Repository check failed: '+name);}};
 const paths=Object.keys(patched);for(const file of paths){if(/\.(?:js|cjs|mjs)$/.test(file))run('Parse '+file,'node',['--check',file]);if(file.endsWith('.html'))run('Parse HTML '+file,'python3',['-c','from html.parser import HTMLParser;import sys;HTMLParser().feed(open(sys.argv[1]).read())',file]);if(file.endsWith('.py'))run('Compile '+file,'python3',['-c','import ast,sys;ast.parse(open(sys.argv[1]).read())',file]);}
 const focusedTests=paths.filter(file=>/(?:^|\/)[^/]+\.(?:test|spec)\.(?:js|cjs|mjs)$/.test(file));
 let pkg;try{pkg=JSON.parse(await fs.readFile(path.join(workspace,'package.json'),'utf8'))}catch{}
 if(pkg){
  if(pkg.packageManager&&!pkg.packageManager.startsWith('npm@'))throw Error('Repository requires '+pkg.packageManager+' adapter');
  if(!pkg.scripts?.test&&!pkg.scripts?.build&&!focusedTests.length)throw Error('Repository has no configured test/build acceptance command');
  run('Install dependencies without lifecycle hooks','npm',['install','--ignore-scripts','--package-lock=false','--no-audit','--no-fund']);
 }
 const focusedArgs=focusedTestCommand(focusedTests,pkg);
 if(focusedArgs)run('Focused Node tests with shared baseline','node',focusedArgs);
 if(pkg){
  if(pkg.scripts?.test)run('Repository tests','npm',['run','test']);if(pkg.scripts?.build)run('Repository build','npm',['run','build']);
 }else if(!runs.length)throw Error('Repository needs an acceptance adapter before committing this file type');
 report.tests={passed:true,runs};return report.tests;
}
try{
 await fs.mkdir('repository-receipts',{recursive:true});
 report.executionContext=executionContext();
 if(!report.executionContext.productionAccess)throw Error('Production adapters disabled: '+report.executionContext.reason);
 report.baseline=await inspectRuntime();
 if(!report.baseline.passed)throw Error('Runtime baseline missing: '+report.baseline.checks.filter(x=>!x.passed).map(x=>x.name).join(', '));
 await call('capability',{status:token?'credential_configured':'credential_missing'});
 if(token){let count=0,pushReported=0;for(let page=1;page<=20;page++){const repos=await github('user/repos?affiliation=owner&per_page=100&page='+page);for(const r of repos){if(r.owner.login!==OWNER)continue;count++;if(r.permissions?.push)pushReported++;}if(repos.length<100)break;}report.inventory={ownerRepositoriesVisible:count,reportedPushPermission:pushReported,note:'Reported account permissions; actual writes are proven by successful commits.'};await call('capability',{status:'credential_configured',repositoriesVisible:count});}
 lease=(await call('claim',{})).lease;
 if(!lease){report.status='idle';}
 else{
  report.jobId=lease.ticketId+'/'+lease.jobId;report.repository=lease.job.repository;
  if(!/^www-infinity4\/[\w.-]+$/.test(report.repository))throw Error('Owner repository scope unresolved');
  if(!token)throw Error('Cross-repository writer credential missing: configure existing Moltnook GHP secret for all owner repositories; repository-local GITHUB_TOKEN cannot grant this scope');
  const repo=await github('repos/'+report.repository);report.permissions=repo.permissions;
  if(repo.archived)throw Error('Target repository is archived');if(!repo.permissions?.push)throw Error('Credential has no reported push access to '+report.repository);
  workspace=await fs.mkdtemp(path.join(os.tmpdir(),'infinity-engine-'));
  command('git',['clone','--single-branch','--branch',repo.default_branch,'https://github.com/'+report.repository+'.git','.'],{env:credentialEnv()});
  const baseSha=git('rev-parse','HEAD');report.baseSha=baseSha;
  await event('gold-diggers-ink','Read access confirmed for '+report.repository+'. Reading pinned README, agent instructions and source tree at '+baseSha.slice(0,9)+'.');
  const tracked=git('ls-files').split('\n');const readme=await sourceFile('README.md'),agents=await sourceFile('AGENTS.md');
  const plan=await call('plan',{evidence:{baseSha,readme:readme?.slice(0,15000),agents:agents?.slice(0,20000),tree:tracked.filter(x=>!/(?:node_modules|package-lock|yarn.lock)/.test(x)).slice(0,1400),runtime:{repositoryCloned:true,reportedPushPermission:repo.permissions?.push===true,baseSha,executor:'authenticated GitHub Actions repository engine',excludedPaths:['.git/','.github/','.env','credentials','secrets'],checks:['JavaScript parse','Python AST parse','HTML parse','focused native Node tests with describe/it/test/hooks preloaded','existing npm test/build'],deployment:'not implemented for arbitrary repositories',forkCreation:'not implemented',adapterRegistry:'none'}}});
  report.plan=plan;
  if(!Array.isArray(plan.blockers))throw Error('Reader omitted unresolved blocker list');
  if(plan.blockers.length){
   if(plan.blockers.some(b=>!b||!['owner_input_required','excluded_path_required','unsupported_acceptance'].includes(b.code)||typeof b.reason!=='string'))throw Error('Reader returned unstructured blockers instead of unresolved conditions');
   throw Error('Reader blocker: '+plan.blockers.map(b=>b.code+': '+b.reason).join('; '));
  }
  if(typeof plan.summary!=='string'||!Array.isArray(plan.files)||!plan.files.length||plan.files.length>12||!Array.isArray(plan.subtasks))throw Error('Reader did not return a complete bounded implementation plan');
  await event('blueberry','Reader refined '+report.jobId+': '+plan.summary.slice(0,250)+'. Handoff contains '+plan.subtasks.length+' subtasks and '+plan.files.length+' source files.');
  const original={};for(const file of plan.files){safePath(file);original[file]=await sourceFile(file);}
  const scopedAgents={};for(const file of plan.files){let folder=path.posix.dirname(file);while(folder!=='.'){const name=folder+'/AGENTS.md';if(!Object.hasOwn(scopedAgents,name)){const instructions=await sourceFile(name);if(instructions)scopedAgents[name]=instructions;}folder=path.posix.dirname(folder);}}
  report.attempts=[];
  const remembered=lease.job.runtimeFeedback?.baseSha===baseSha?lease.job.runtimeFeedback:undefined;
  const repaired=await repairWithFeedback({
   initialFeedback:remembered,
   build:async feedback=>{
    const proposal=await call('build',{evidence:{baseSha,plan,source:original,agents,scopedAgents,feedback,previousTests:report.tests||remembered?.tests}});report.proposalReason=proposal.reason;
    if(proposal.edits?.some(e=>!Object.hasOwn(original,e.path)))throw Error('Engineer attempted a file absent from the reader handoff');
    const patched=applyEdits(original,proposal.edits);
    await event('greenbeans','Engineer produced '+Object.keys(patched).length+' real source changes for '+report.repository+'. Sending exact edits to independent review.');
    report.proposal=proposal;
    return {proposal,patched};
   },
   review:async candidate=>{
    const review=await call('engine-review',{evidence:{baseSha,plan,edits:candidate.proposal.edits,source:original}});report.review=review;return review;
   },
   test:async candidate=>{
    for(const [file,content]of Object.entries(candidate.patched)){const target=inside(workspace,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content);}
    await checks(candidate.patched);testsPassed=true;
    await event('pink-panther','Independent patch review approved; '+report.tests.runs.length+' actual repository checks passed. GPT Purple receives the outputs before any commit.');
    return report.tests;
   },
   arbitrate:async(candidate,review,tests)=>{
    const arbitration=await call('arbitrate',{evidence:{baseSha,plan,review,tests,edits:candidate.proposal.edits,patched:candidate.patched}});report.arbitration=arbitration;
    await event('gpt-purple',arbitration.decision+': '+arbitration.reason);return arbitration;
   },
   restore:async()=>{testsPassed=false;git('reset','--hard',baseSha);git('clean','-fd');},
   onFeedback:async feedback=>{
    feedback.reason=scrub(feedback.reason);report.attempts.push({...feedback,proposal:report.proposal,review:report.review,tests:report.tests,arbitration:report.arbitration});
    await event(feedback.stage==='arbitration'?'gpt-purple':'pink-panther','Attempt '+feedback.attempt+' failed at '+feedback.stage+': '+feedback.reason.slice(0,240)+'. Exact feedback returns to Green; maximum three attempts.');
   }
  });
  const {patched}=repaired.candidate;report.repairAttempt=repaired.attempt;
  // Prevent unrelated test/build output or concurrent edits from being included.
  for(const [file,content]of Object.entries(patched))if(await sourceFile(file)!==content)throw Error('Checks changed reviewed source: '+file);
  command('git',['fetch','origin',repo.default_branch],{env:credentialEnv()});if(git('rev-parse','origin/'+repo.default_branch)!==baseSha)throw Error('Repository head changed; retry reader against the new commit');
  git('config','user.name','infinity-repository-engine[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');git('add','--',...Object.keys(patched));
  git('-c','core.hooksPath=/dev/null','commit','-m','Implement '+report.jobId+' after reader handoff, tests and GPT Purple arbitration');commitSha=git('rev-parse','HEAD');
  command('git',['push','origin','HEAD:'+repo.default_branch],{env:credentialEnv()});
  report.status='committed_unverified';report.commitSha=commitSha;report.changedFiles=Object.keys(patched);
  report.liveSource=await observeLiveSource({repository:report.repository,commitSha,patched});
  await fs.writeFile('repository-receipts/live-source.json',JSON.stringify(report.liveSource,null,2));
  await event('pink-panther','Live source observation: '+report.liveSource.status+'. '+report.liveSource.files.filter(x=>x.matched).length+' exact public assets match the commit. Feature acceptance remains unverified.');
  try{const preview=await captureSourceViews({workspace,repository:report.repository,baseSha,commitSha,paths:report.changedFiles,entry:plan.previewPath||'index.html',summary:'Bot implementation: '+plan.summary,jobId:report.jobId});await fs.writeFile('repository-receipts/work-preview.json',JSON.stringify(preview));await call('preview',{preview,verificationToken:token});report.previewPublished=true;}catch(e){report.previewError=scrub(e.message);await event('pink-panther','Source committed; visual preview needs its adapter: '+report.previewError);} 
  await call('result',{status:'committed_unverified',commitSha,testsPassed,verificationToken:token,message:'Implemented '+report.jobId+' in '+report.repository+'. Reader handoff, independent review, repository checks and GPT Purple approval recorded. Commit '+commitSha.slice(0,9)+'. Deployment and job-specific live acceptance still need verification; source work is not marked complete.'});
 }
}catch(e){
 report.status=commitSha?'committed_unverified':'blocked';report.error=scrub(e.message);console.error(report.status,report.error);
 if(lease)try{await call('result',{status:report.status,commitSha,testsPassed,verificationToken:token,message:report.error,repairFeedback:report.attempts?.length?{baseSha:report.baseSha,stage:report.attempts.at(-1).stage,reason:report.attempts.at(-1).reason,tests:report.tests?{passed:report.tests.passed,runs:report.tests.runs.slice(-15).map(row=>({...row,output:row.output.slice(0,1000)}))}:null}:undefined});}catch(error){report.receiptError=scrub(error.message)}
 process.exitCode=1;
}finally{await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/report.json',JSON.stringify(report,null,2));console.log(report.status,report.jobId||'',report.commitSha||'');}
