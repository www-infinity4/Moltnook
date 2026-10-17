import {collectDependencyContext} from './dependency-context.mjs';
import {publishReviewed} from './publish-reviewed.mjs';
import {archiveScreenshots} from './archive-screenshots.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {applyEdits,safePath,inside} from './patch.mjs';
import {sourceWindows,recalculateBounds,checkVisibleEdits,visibleEditFeedback,patchDigests,boundedPatched} from './context-windows.mjs';
import {inspectionEvents,submitInspectionEvents} from './transition-stream/bot-adapter.mjs';
import {validateOracleCssEdit} from './oracle-style-contract.mjs';
import {captureSourceViews} from './preview.mjs';
import {repairWithFeedback} from './repair-feedback.mjs';
import {inspectRuntime,focusedTestCommand,missingAcceptanceAdapterMessage} from './runtime-baseline.mjs';
import {observeLiveSource} from './live-source.mjs';
import {verifyLiveBrowser} from './live-browser.mjs';
import {executionContext} from './execution-context.mjs';
import {collectSourceEvidence} from './source-evidence.mjs';
import {collectLinkFacts} from './source-links.mjs';
import {readWorkflowEvidence} from './workflow-evidence.mjs';
import {discoverScopedCapabilities} from './scoped-capabilities.mjs';
import {retryStructuredModelCall} from './model-format-retry.mjs';
import {evidenceReplanFeedback} from './evidence-replan.mjs';
import {deriveFeatureManifest} from './feature-manifest.mjs';
import {skillPackets} from './phi-skills.mjs';
const API='https://infinity-brain-clock.marvaseater.workers.dev',OWNER='www-infinity4';
const token=process.env.REPOSITORY_WRITE_TOKEN||'';
const report={schemaVersion:1,when:new Date().toISOString(),status:'starting',events:[],credentials:{configured:!!token,valuesExposed:false}};
let lease,workspace,commitSha,testsPassed=false;
const phaseSkills=phase=>skillPackets({task:[lease?.job?.instructions,lease?.job?.ownerRequest].filter(Boolean).join(' '),repository:lease?.job?.repository||'',phase});
const cleanEnv={PATH:process.env.PATH,HOME:process.env.HOME,CI:'true',LANG:'C.UTF-8'};
const credentialEnv=()=>({...cleanEnv,GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_1:'core.hooksPath',GIT_CONFIG_VALUE_1:'/dev/null',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:'AUTHORIZATION: basic '+Buffer.from('x-access-token:'+token).toString('base64')});
const command=(cmd,args,options={})=>execFileSync(cmd,args,{cwd:workspace,encoding:'utf8',timeout:180000,maxBuffer:3*1024*1024,env:cleanEnv,...options});
const git=(...args)=>command('git',args).trim();
function scrub(value){return String(value).replaceAll(token||'__NO_TOKEN__','[redacted]').slice(-9000);}
async function github(resource,options={}){const r=await fetch('https://api.github.com/'+resource,{method:options.method||'GET',...(options.body?{body:JSON.stringify(options.body)}:{}),headers:{Accept:'application/vnd.github+json','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GitHub '+r.status+' at '+resource.split('?')[0]);return r.json();}
async function call(step,body={}){
 const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);identityUrl.searchParams.set('audience','infinity-brain-writer');
 const response=await fetch(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Runner identity unavailable');const {value}=await response.json();
 const r=await fetch(API+'/runner/'+step,{method:'POST',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({...body,key:lease?.key,leaseId:lease?.leaseId}),signal:AbortSignal.timeout(180000)});
 const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'Robot brain HTTP '+r.status);
 if(step==='result'){
  const proof=await call('quant-receipt');
  if(proof.durableReadback!==true||proof.latestFiveContains!==true||proof.status!==body.status||proof.repository!==report.repository||typeof proof.quantId!=='string')throw Error('Live job Quant receipt did not match this execution');
  report.jobQuant={...proof,verified:true};await fs.writeFile('repository-receipts/job-quant-verification.json',JSON.stringify(report.jobQuant,null,2));
 }
 return result;
}
async function event(agent,message){const row={agent,message,when:new Date().toISOString()};report.events.push(row);await call('event',row);}
async function sourceFile(file,maxBytes=400000){safePath(file);const absolute=inside(workspace,file);try{
 const parts=file.split('/');let current=workspace;for(const part of parts){current=path.join(current,part);const st=await fs.lstat(current);if(st.isSymbolicLink())throw Error('Writer refuses symlink source');}
 const s=await fs.readFile(absolute,'utf8');if(Buffer.byteLength(s)>maxBytes)throw Error('Source requires a smaller task: '+file);return s;
 }catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function checks(patched){
 const runs=[];const run=(name,cmd,args)=>{try{const output=command(cmd,args);runs.push({name,passed:true,output:scrub(output)});}catch(e){runs.push({name,passed:false,output:scrub(e.stdout||e.stderr||e.message)});report.tests={passed:false,runs};throw Error('Repository check failed: '+name+': '+scrub(e.stderr||e.stdout||e.message).slice(0,900));}};
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
 }else if(!runs.length)throw Error(missingAcceptanceAdapterMessage(paths));
 report.tests={passed:true,runs};return report.tests;
}
try{
 await fs.mkdir('repository-receipts',{recursive:true});
 report.executionContext=executionContext();
 if(!report.executionContext.productionAccess)throw Error('Production adapters disabled: '+report.executionContext.reason);
 report.jobQuantAudit=await call('quant-audit');
 await fs.writeFile('repository-receipts/job-quant-audit.json',JSON.stringify(report.jobQuantAudit,null,2));
 report.baseline=await inspectRuntime();
 if(!report.baseline.passed)throw Error('Runtime baseline missing: '+report.baseline.checks.filter(x=>!x.passed).map(x=>x.name).join(', '));
 const liveWindowCapability=await call('capability',{status:token?'credential_configured':'credential_missing'});
 const useWindowV2=liveWindowCapability.sourceWindowsV2===true&&liveWindowCapability.arbitrationDigestValidation===true;
 report.sourceProtocol=useWindowV2?'bounded-windows-v2':'legacy-small-files-only';
 if(token){let count=0,pushReported=0;for(let page=1;page<=20;page++){const repos=await github('user/repos?affiliation=owner&per_page=100&page='+page);for(const r of repos){if(r.owner.login!==OWNER)continue;count++;if(r.permissions?.push)pushReported++;}if(repos.length<100)break;}report.inventory={ownerRepositoriesVisible:count,reportedPushPermission:pushReported,note:'Reported account permissions; actual writes are proven by successful commits.'};await call('capability',{status:'credential_configured',repositoriesVisible:count});}
 lease=(await call('claim',{})).lease;
 if(!lease){report.status='idle';}
 else{
  report.jobId=lease.ticketId+'/'+lease.jobId;report.repository=lease.job.repository;
  // These capabilities were exercised above, not inferred from missing repo secrets.
  report.authenticatedAdapters={brain:{origin:API,authentication:'GitHub Actions OIDC audience infinity-brain-writer',verifiedCalls:['quant-audit','capability','claim'],leaseClaimed:true,leaseKeyPresent:typeof lease.key==='string'&&lease.key.length>0,leaseIdPresent:typeof lease.leaseId==='string'&&lease.leaseId.length>0,implementedIn:'Moltnook/agents/repository-engine/runner.mjs call(step, body)',createNewLeasesVerified:false,directD1AccessVerified:false},deployment:{arbitraryRepositoryAdapter:false,cloudflareCredentialVerified:false},permissionsExpanded:false};
  report.skillImport={source:'pinned Moltnook phi-skills.mjs',roles:{blue:phaseSkills('plan').map(x=>x.id),green:phaseSkills('build').map(x=>x.id),pink:phaseSkills('review').map(x=>x.id),purpleBlack:phaseSkills('arbitrate').map(x=>x.id)},executedAsCode:false,permissionsGranted:false};
  if(!/^www-infinity4\/[\w.-]+$/.test(report.repository))throw Error('Owner repository scope unresolved');
  if(!token)throw Error('Cross-repository writer credential missing: configure existing Moltnook GHP secret for all owner repositories; repository-local GITHUB_TOKEN cannot grant this scope');
  const repo=await github('repos/'+report.repository);report.permissions=repo.permissions;
  if(repo.archived)throw Error('Target repository is archived');if(!repo.permissions?.push)throw Error('Credential has no reported push access to '+report.repository);
  workspace=await fs.mkdtemp(path.join(os.tmpdir(),'infinity-engine-'));
  command('git',['clone','--single-branch','--branch',repo.default_branch,'https://github.com/'+report.repository+'.git','.'],{env:credentialEnv()});
  const baseSha=git('rev-parse','HEAD');report.baseSha=baseSha;
  await event('gold-diggers-ink','Read access confirmed for '+report.repository+'. Reading pinned README, agent instructions and source tree at '+baseSha.slice(0,9)+'.');
  const dependencyContext=await collectDependencyContext({task:[lease.job.instructions,lease.job.ownerRequest].filter(Boolean).join(' '),target:report.repository,github});
  report.dependencyContext=dependencyContext;
  await fs.writeFile('repository-receipts/dependency-context.json',JSON.stringify(dependencyContext,null,2));
  const tracked=git('ls-files').split('\n');const readme=await sourceFile('README.md'),agents=await sourceFile('AGENTS.md');
  // Read actual safe source snippets before declaring a link or target absent.
  const sourceSamples=await collectSourceEvidence({paths:tracked,task:lease.job.instructions+' '+(lease.job.ownerRequest||''),read:file=>sourceFile(file,1250000),readWorkflow:file=>readWorkflowEvidence(workspace,file)});
  const linkFacts=await collectLinkFacts({paths:tracked,task:lease.job.instructions+' '+(lease.job.ownerRequest||''),read:file=>sourceFile(file,1250000)});
  const scopedCapabilities=await discoverScopedCapabilities({paths:tracked,readWorkflow:file=>readWorkflowEvidence(workspace,file),readSource:file=>sourceFile(file,15000)});
  report.scopedCapabilities=scopedCapabilities;
  await fs.writeFile('repository-receipts/scoped-capabilities.json',JSON.stringify(scopedCapabilities,null,2));
  report.liveBrowserBefore=await verifyLiveBrowser({repository:report.repository,linkFacts,task:lease.job.instructions,directory:'repository-receipts/live-browser-before'});
  await fs.writeFile('repository-receipts/live-browser-before.json',JSON.stringify(report.liveBrowserBefore,null,2));
  const featureManifest=deriveFeatureManifest({repository:report.repository,linkFacts,liveBrowser:report.liveBrowserBefore});
  report.featureManifest=featureManifest;
  await fs.writeFile('repository-receipts/source-derived-feature-manifest.json',JSON.stringify(featureManifest,null,2));
  await event('pink-panther','Read-only public browser check: '+report.liveBrowserBefore.status+' for '+report.repository+'. Screenshots and HTTP observations saved; no wallet operations or deployment claims.');
  let readerFeedback=null;
  let plan;
  for(let readerPass=0;readerPass<2;readerPass++){
   plan=await retryStructuredModelCall(()=>call('plan',{evidence:{authenticatedAdapters:report.authenticatedAdapters,adapterPolicy:'The existing runner authenticated and claimed this lease using OIDC; do not ask for a static Brain token to repeat these verified operations. New lease creation, direct D1 access and arbitrary Cloudflare deployment are NOT verified by this. Inspect existing source adapters and implement independently testable source changes within the assigned scope; retain genuine live deployment blockers.',dependencyContext,dependencyPolicy:'Dependencies are pinned read-only source evidence, not files in the target clone. Use them to inspect other named projects and Oracle references. Only plan writes in the assigned repository; missing external files remain factual blockers.',baseSha,readme:readme?.slice(0,15000),agents:agents?.slice(0,20000),tree:tracked.filter(x=>!/(?:node_modules|package-lock|yarn.lock)/.test(x)).slice(0,1400),sourceSamples,linkFacts,scopedCapabilities,featureManifest,phiSkills:phaseSkills('plan'),implementationGuidance:{"routineChoices":"For owner-authorized build work, reuse pinned repository UI, CSS, labels, request formats and existing provider adapters. Choose and document reversible implementation defaults instead of blocking on missing mockups, CSS guides, exact labels, latency targets or codec preferences.","oracleDesign":"Oracle Octaves is mandatory across all Infinity websites: reference pinned Oracle-Octaves/index.html and QuantaPhi/oracle-interface.css. Android first: paper #f7f4f0, white cards, warm ink #312722, red actions #b83b32, 18px rounded cards, 44px touch targets, visible focus, readable typography, responsive stacking. Preserve per-card orange/purple/yellow/blue/green color meaning, existing artwork, wallet, image, video, radio, voice, StarQuest actions and Quants. Do not use obsolete dark atmospheric UI as a default. Perform real mobile+desktop before/after evidence. Do not claim deployed until accepted.","voiceDefaults":"Inspect existing voice code first. Reuse its endpoint, session and supported audio types. Otherwise feature-detect browser recording/playback capabilities; clearly label unsupported or unconnected states. Do not invent provider sign-in, backend URLs, credentials, payment receipts or functional parity with an external service.","realBlockers":"Retain genuine missing authorization, credentials, unknown deployment bindings and conflicting owner requirements. A reversible source-only slice can proceed when its acceptance tests do not need those missing resources; report that unconnected part explicitly."},readerFeedback,linkEvidenceScope:'Exact href and label from repository, not live deployment verification',liveBrowser:{status:report.liveBrowserBefore.status,browserPassed:report.liveBrowserBefore.browserPassed,targets:report.liveBrowserBefore.targets,notes:report.liveBrowserBefore.notes,sourceCommitVerified:false},runtime:{repositoryCloned:true,reportedPushPermission:repo.permissions?.push===true,baseSha,executor:'authenticated GitHub Actions repository engine',excludedPaths:['.git/','.env','credentials','secrets'],workflowSourceReadOnly:false,workflowChangesRequireSeparateApproval:false,ownerAuthorization:'All code and workflow paths in the assigned www-infinity4 repository; normal tests and exact-head merge verification remain required',checks:['JavaScript parse','Python AST parse','HTML parse','focused native Node tests with describe/it/test/hooks preloaded','existing npm test/build'],publicLiveBrowser:'Anonymous read-only Playwright on quantaphi.org, 360px mobile and 1280px desktop, safe same-origin navigation and screenshot receipts; no login or Cloudflare API token needed',deployment:'not implemented for arbitrary repositories',sourceOnlyCommit:'A passing independently reviewed patch can be recorded as committed_unverified; deployment and browser acceptance are separate',forkCreation:'not implemented',adapterRegistry:'Pinned repository workflow and wrangler facts supplied in scopedCapabilities; read-only and do not confer write or deploy permissions'}}}),{onRetry:({attempt})=>event('pink-panther','Model response contained invalid JSON on reader attempt '+attempt+'. Safely retrying the same pinned evidence. No source or wallet changes made.')});
   if(!Array.isArray(plan?.blockers))break;
const correction=evidenceReplanFeedback({plan,task:lease.job.instructions,ownerRequest:lease.job.ownerRequest,linkFacts,liveBrowser:report.liveBrowserBefore,scopedCapabilities,agentInstructions:agents||'',sourceTree:tracked.filter(x=>!/(?:node_modules|package-lock|yarn.lock)/.test(x)).slice(0,1400),writeScope:{repository:report.repository,reportedPushPermission:repo.permissions?.push===true},dependencyContext,authenticatedAdapters:report.authenticatedAdapters});
   if(readerPass===0&&correction.retry){
    readerFeedback=correction;
    report.readerFeedback=correction;
    await fs.writeFile('repository-receipts/reader-evidence-feedback.json',JSON.stringify(correction,null,2));
    await event('blueberry','Reader reported existing facts missing; one bounded evidence-based replan requested. Categories: '+correction.categories.join(', ')+'. No credentials or writer permissions changed.');
    continue;
   }
   break;
  }
  report.plan=plan;
  await event('blueberry','Verified repository capabilities: '+scopedCapabilities.existingWorkflows.length+' existing workflow files, '+scopedCapabilities.testCommands.length+' test commands, '+scopedCapabilities.cloudflare.length+' Cloudflare manifests. Missing secret values remain unresolved.');
  if(!Array.isArray(plan.blockers))throw Error('Reader omitted unresolved blocker list');
  if(plan.blockers.length){
   if(plan.blockers.some(b=>!b||!['owner_input_required','excluded_path_required','unsupported_acceptance'].includes(b.code)||typeof b.reason!=='string'))throw Error('Reader returned unstructured blockers instead of unresolved conditions');
   throw Error('Reader blocker: '+plan.blockers.map(b=>b.code+': '+b.reason).join('; '));
  }
  if(typeof plan.summary!=='string'||!Array.isArray(plan.files)||!plan.files.length||plan.files.length>12||!Array.isArray(plan.subtasks))throw Error('Reader did not return a complete bounded implementation plan');
  await event('blueberry','Reader refined '+report.jobId+': '+plan.summary.slice(0,250)+'. Handoff contains '+plan.subtasks.length+' subtasks and '+plan.files.length+' source files.');
  const original={};for(const file of plan.files){safePath(file);original[file]=await sourceFile(file);}
  const windowTask=[lease.job.instructions,lease.job.ownerRequest].filter(Boolean).join(' ');
  const initialWindowEvidence=sourceWindows(original,{task:windowTask,plan});
  let windowEvidence=initialWindowEvidence;
  if(!useWindowV2&&JSON.stringify(original).length>32000)throw Error('brain_clock_bounded_windows_v2_not_deployed: large source edit is blocked; small jobs may use legacy review');
  let modelSource=useWindowV2?windowEvidence.source:original;
  await fs.writeFile('repository-receipts/immutable-window-manifest.json',JSON.stringify({baseSha,source:Object.fromEntries(Object.entries(windowEvidence.source).map(([p,x])=>[p,{totalChars:x.totalChars,sha256:x.sha256,windows:x.windows.map(w=>({start:w.start,end:w.end,sha256:w.sha256}))}]))},null,2));
  // Optional inspection metadata. A queue receipt is neither a D1 commit nor wallet payment.
  report.transitionStream={status:'not_configured',payoutIssued:false};
  if(process.env.BOT_TRANSITIONS_URL&&process.env.BOT_INGEST_TOKEN){
   try{
    const {events}=inspectionEvents({original,task:[lease.job.instructions,lease.job.ownerRequest].filter(Boolean).join(' '),
      repository:report.repository,commitSha:baseSha,jobId:report.jobId,
      quantId:'scan:'+report.jobId.replace(/[^A-Za-z0-9_.:-]/g,'_').slice(0,95),agentId:'pink-panther'});
    const receipt=await submitInspectionEvents(events,{url:process.env.BOT_TRANSITIONS_URL,
      bearerToken:process.env.BOT_INGEST_TOKEN});
    report.transitionStream={status:'queued_not_persisted',...receipt};
   }catch(e){
    report.transitionStream={status:'enqueue_failed',error:String(e.message||e).slice(0,200),payoutIssued:false};
   }
   await fs.writeFile('repository-receipts/transition-queue-status.json',JSON.stringify(report.transitionStream,null,2));
  }
  const compactPlan={summary:String(plan.summary).slice(0,2400),files:plan.files,requirements:(plan.requirements||[]).slice(0,12),acceptance:(plan.acceptance||[]).slice(0,12),subtasks:(plan.subtasks||[]).slice(0,12)};
  const compactTests=tests=>({passed:tests?.passed===true,runs:(tests?.runs||[]).slice(-12).map(x=>({name:x.name,passed:x.passed,output:String(x.output||'').slice(-350)}))});
  const scopedAgents={};for(const file of plan.files){let folder=path.posix.dirname(file);while(folder!=='.'){const name=folder+'/AGENTS.md';if(!Object.hasOwn(scopedAgents,name)){const instructions=await sourceFile(name);if(instructions)scopedAgents[name]=instructions;}folder=path.posix.dirname(folder);}}
  report.attempts=[];
  // These are pinned baseline facts, not new owner requirements or payment proof.
  // Supply the same provenance to both independent reviewers.
  const pinnedControls=(report.featureManifest?.checks||[]).slice(0,12).map(check=>({
    sourcePath:check.sourcePath,selector:check.selector,
    existingLabel:check.currentLabel,existingHref:check.sourceHref,
    sourceEvidence:true,ownerSpecified:false
  }));
  const remembered=lease.job.runtimeFeedback?.baseSha===baseSha?lease.job.runtimeFeedback:undefined;
  let rejectedSourceEdits=[];
  const repaired=await repairWithFeedback({
   initialFeedback:remembered,
   build:async feedback=>{
    const proposal=await retryStructuredModelCall(()=>call('build',{evidence:{baseSha,plan:compactPlan,source:modelSource,sourceWindowsSchema:useWindowV2?windowEvidence.schemaVersion:null,agents:agents?.slice(0,9000),scopedAgents:Object.fromEntries(Object.entries(scopedAgents).map(([p,x])=>[p,x.slice(0,3500)])),phiSkills:phaseSkills('build'),feedback,previousTests:report.tests?compactTests(report.tests):remembered?.tests}}),{onRetry:({attempt})=>event('pink-panther','Malformed build JSON on response '+attempt+'. Retrying the same pinned source and repair findings; no source changes made.')});report.proposalReason=proposal.reason;rejectedSourceEdits=Array.isArray(proposal.edits)?proposal.edits:[];
    const unplannedPaths=proposal.edits?.filter(e=>!Object.hasOwn(original,e.path)).map(e=>String(e.path));
    if(unplannedPaths?.length)throw Error('Engineer attempted files absent from the reader handoff: '+JSON.stringify(unplannedPaths)+'. Allowed paths: '+JSON.stringify(Object.keys(original))+'. Return edits only for the allowed paths; do not expand the reader plan.');
    if(useWindowV2&&!checkVisibleEdits(windowEvidence,proposal.edits))throw Error('Model attempted an edit outside the pinned source windows. '+visibleEditFeedback(windowEvidence,proposal.edits));
    for(const edit of proposal.edits)validateOracleCssEdit(edit.path,edit.after);
    const patched=applyEdits(original,proposal.edits);
    await event('greenbeans','Engineer produced '+Object.keys(patched).length+' real source changes for '+report.repository+'. Sending exact edits to independent review.');
    report.proposal=proposal;
    return {proposal,patched};
   },
   review:async candidate=>{
    const review=await call('engine-review',{evidence:{baseSha,plan:compactPlan,edits:candidate.proposal.edits,source:modelSource,phiSkills:phaseSkills('review'),pinnedControls}});report.review=review;return review;
   },
   test:async candidate=>{
    for(const [file,content]of Object.entries(candidate.patched)){const target=inside(workspace,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content);}
    await checks(candidate.patched);testsPassed=true;
    await event('pink-panther','Independent patch review approved; '+report.tests.runs.length+' actual repository checks passed. GPT Purple receives the outputs before any commit.');
    return report.tests;
   },
   arbitrate:async(candidate,review,tests)=>{
    const arbitration=await call('arbitrate',{evidence:{baseSha,plan:compactPlan,review,tests:compactTests(tests),edits:candidate.proposal.edits,patched:useWindowV2?boundedPatched(candidate.patched):candidate.patched,...(useWindowV2?{patchedHashes:patchDigests(candidate.patched)}:{}),source:modelSource,phiSkills:phaseSkills('arbitrate'),pinnedControls}});report.arbitration=arbitration;
    await event('gpt-purple',arbitration.decision+': '+arbitration.reason);return arbitration;
   },
   restore:async()=>{testsPassed=false;git('reset','--hard',baseSha);git('clean','-fd');},
   onFeedback:async feedback=>{
    // Only a build-window rejection (including empty edits) may request
    // an alternate bounded source view. Replan from the original pinned SHA;
    // do not modify the allowed file list or weaken review/push gates.
    if(useWindowV2&&feedback.stage==='build'&&
      /Model attempted an edit outside the pinned source windows/.test(feedback.reason)){
     const shifted=recalculateBounds(original,windowEvidence,{
      attempt:Math.min(2,feedback.attempt),baseline:initialWindowEvidence,
      expansionRatio:1.5,task:windowTask,plan,rejectedEdits:rejectedSourceEdits
     });
     if(shifted.replanned){
      windowEvidence=shifted;modelSource=shifted.source;
      const receipt={attempt:feedback.attempt,baseSha,maximumChars:shifted.maximumChars,
       originalFileHashes:Object.fromEntries(Object.entries(initialWindowEvidence.source).map(([p,x])=>[p,x.sha256])),
       windows:Object.fromEntries(Object.entries(shifted.source).map(([p,x])=>[p,x.windows.map(w=>({start:w.start,end:w.end,sha256:w.sha256}))])),
       privilegedWrites:false};
      await fs.writeFile('repository-receipts/source-window-replan-'+feedback.attempt+'.json',JSON.stringify(receipt,null,2));
      feedback.windowReplan={applied:true,attempt:feedback.attempt,maxChars:shifted.maximumChars,sourceHashesUnchanged:true};
     }else feedback.windowReplan={applied:false,reason:'No additional pinned source region was available'};
    }
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
  report.publication=await publishReviewed({repository:report.repository,base:repo.default_branch,commitSha,jobId:report.jobId,runId:process.env.GITHUB_RUN_ID,push:ref=>command('git',['push','origin',ref],{env:credentialEnv()}),api:github});
  if(report.publication?.publishedToDefault!==false||!report.publication?.prUrl)throw Error('Missing isolated bot branch PR publication receipt');
  report.status='committed_unverified';report.commitSha=commitSha;report.changedFiles=Object.keys(patched);
  await event('gpt-purple','Reviewed patch staged in '+report.publication.branch+' as pull request '+report.publication.prUrl+'. Main remains unchanged; target CI and merge verification remain pending.');
  report.liveSource=await observeLiveSource({repository:report.repository,commitSha,patched});
  report.liveBrowserAfter=await verifyLiveBrowser({repository:report.repository,linkFacts,task:lease.job.instructions,directory:'repository-receipts/live-browser-after'});
  await fs.writeFile('repository-receipts/live-browser-after.json',JSON.stringify(report.liveBrowserAfter,null,2));
  await event('pink-panther','Post-commit public browser: '+report.liveBrowserAfter.status+'. Source deployment and authenticated feature acceptance remain independently gated.');
  await fs.writeFile('repository-receipts/live-source.json',JSON.stringify(report.liveSource,null,2));
  await event('pink-panther','Live source observation: '+report.liveSource.status+'. '+report.liveSource.files.filter(x=>x.matched).length+' exact public assets match the commit. Feature acceptance remains unverified.');
  try{const preview=await captureSourceViews({workspace,repository:report.repository,baseSha,commitSha,paths:report.changedFiles,entry:plan.previewPath||'index.html',summary:'Bot implementation: '+plan.summary,jobId:report.jobId});await fs.writeFile('repository-receipts/work-preview.json',JSON.stringify(preview));await call('preview',{preview,verificationToken:token});report.previewPublished=true;}catch(e){report.previewError=scrub(e.message);await event('pink-panther','Source committed; visual preview needs its adapter: '+report.previewError);} 
  await call('result',{status:'committed_unverified',commitSha,testsPassed,verificationToken:token,message:'Implemented '+report.jobId+' in '+report.repository+'. Reader handoff, independent review, repository checks and GPT Purple approval recorded. Commit '+commitSha.slice(0,9)+(report.publication.prUrl?' · reviewed PR '+report.publication.prUrl:'')+'. Deployment and job-specific live acceptance still need verification; source work is not marked complete.'});
 }
}catch(e){
 report.status=commitSha?'committed_unverified':'blocked';report.error=scrub(e.message);console.error(report.status,report.error);
 if(lease)try{await call('result',{status:report.status,commitSha,testsPassed,verificationToken:token,message:report.error,repairFeedback:report.attempts?.length?{baseSha:report.baseSha,stage:report.attempts.at(-1).stage,reason:report.attempts.at(-1).reason,failures:report.attempts.at(-1).failures,tests:report.tests?{passed:report.tests.passed,runs:report.tests.runs.slice(-15).map(row=>({...row,output:row.output.slice(0,1000)}))}:null}:undefined});}catch(error){report.receiptError=scrub(error.message)}
 process.exitCode=1;
}finally{if(lease&&/^[a-f0-9]{40}$/.test(commitSha||report.baseSha||''))try{report.visualEvidence=await archiveScreenshots('repository-receipts',{repository:lease.job.repository||lease.repository,commitSha:commitSha||report.baseSha},call)}catch(e){report.evidenceArchiveError=String(e.message).slice(0,300)}await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/report.json',JSON.stringify(report,null,2));console.log(report.status,report.jobId||'',report.commitSha||'');}
