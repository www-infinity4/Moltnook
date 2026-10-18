// Never suppress a blocker: request ONE evidence-grounded second opinion from
// the Yellow reader when it asks the owner for facts demonstrably present in
// the pinned source or the anonymous browser receipt.
const LABEL=/\b(?:label|button text|text of|main and sub|wording)\b/i;
const DESTINATION=/\b(?:destination|target url|link url|href|where.*(?:link|button))\b/i;
const DEPLOYMENT=/\b(?:cloudflare|deploy(?:ment)?|api token|account id|health.check)\b/i;
const RUNNER=/\b(?:runner|test suite|test entry|test command|environment variables|scoped runner)\b/i;
const EXPLICIT_LABEL=/\b(?:rename|relabel|change (?:the )?(?:label|wording|text)|replace (?:the )?(?:label|text)|must say|should read)\b/i;
const EXPLICIT_URL=/\b(?:change (?:the )?(?:destination|url|link)|point (?:it|the link) to|link to https?:\/\/|redirect to https?:\/\/)\b/i;
const EXPLICIT_DEPLOY=/\b(?:deploy|redeploy|publish|production release|migrate database|apply migration)\b/i;
const trim=s=>String(s||'').slice(0,280);
const CODE_LOCATION=/\b(?:source\s+files?|file\s+paths?|which\s+files?|exact\s+(?:component|file)|locate|component|source\s+location|ui\s+behaviou?r|filter|sorting|toggle)\b/i;
const PRIVATE_SCOPE=/\b(?:credential|secret|authentication|api\s+key|token|authorization|permission|private\s+endpoint|database\s+schema|billing|wallet\s+transfer)\b/i;
function sourceCandidates(sourceTree,request){
 if(!Array.isArray(sourceTree))return [];
 const words=new Set(String(request||'').toLowerCase().match(/[a-z]{4,}/g)||[]);
 const terms=[...words].map(w=>w.endsWith('s')?w.slice(0,-1):w);
 return sourceTree.filter(p=>typeof p==='string'&&p.length<180&&/\.(?:js|mjs|cjs|css|html|ts|tsx|jsx|py)$/.test(p)&&
   !/(?:^|\/)(?:test|tests|node_modules|\.github|\.git|vendor|dist|secrets?)(?:\/|$)/i.test(p))
  .map(p=>({path:p,score:terms.reduce((n,w)=>n+(p.toLowerCase().includes(w)?1:0),0)}))
  .filter(p=>p.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path))
  .slice(0,7).map(p=>p.path);
}
export function evidenceReplanFeedback({plan,task='',ownerRequest='',linkFacts=[],liveBrowser,scopedCapabilities={},agentInstructions='',sourceTree=[],writeScope=null,dependencyContext=null,authenticatedAdapters=null}={}){
 const blockers=Array.isArray(plan?.blockers)?plan.blockers:[];
 const request=String(task||'')+' '+String(ownerRequest||'');
 const facts=[],matchedCodes=[];
 const links=(Array.isArray(linkFacts)?linkFacts:[]).filter(x=>x&&typeof x.href==='string'&&typeof x.label==='string'&&x.href.length<400&&x.label.length<170).slice(0,5);
 const viewTargets=Array.isArray(liveBrowser?.targets)?liveBrowser.targets:[];
 for(const blocker of blockers){
  if(!blocker||typeof blocker.reason!=='string')continue;
  const reason=blocker.reason;
  // The model may hallucinate that a file in a different owner's repository
  // is absent because the writable clone is Moltnook. Only pinned, hash-
  // verified dependency files are evidence of presence; never infer access.
  const normalized=String(reason).replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g,'-').toLowerCase();
  if(blocker.code==='owner_input_required'&&/(?:missing|do not exist|not present|cannot (?:find|locate|inspect)|lacks)/i.test(normalized)){
   const sources=(Array.isArray(dependencyContext?.repositories)?dependencyContext.repositories:[])
    .filter(row=>row.status==='verified_read_only'&&normalized.includes(String(row.repository||'').toLowerCase()))
    .flatMap(row=>(Array.isArray(row.files)?row.files:[])
     .filter(file=>file.status==='verified_source'&&typeof file.path==='string'&&
       (normalized.includes(file.path.toLowerCase())||normalized.includes(file.path.split('/').at(-1).toLowerCase())))
     .map(file=>row.repository+'/'+file.path));
   if(sources.length){
    facts.push('A pinned cross-repository read already verified these exact source blobs: '+sources.slice(0,4).join(', ')+'. They are read-only reference material for the current task; do not claim them missing or infer permission to edit that other repository.');
    matchedCodes.push('verified_dependency_source');continue;
   }
  }
  // Authentication to the Brain claim API is a signed GitHub Actions OIDC
  // exchange, not a missing static BRAIN_LEASE_TOKEN secret. Never claim this
  // without the executor's successful authenticated claim receipt.
  const brain=authenticatedAdapters?.brain;
  if(blocker.code==='owner_input_required'&&brain?.leaseClaimed===true&&
    Array.isArray(brain.verifiedCalls)&&brain.verifiedCalls.includes('claim')&&
    /oidc/i.test(String(brain.authentication||''))&&
    /(?:brain.lease.token|oidc|brain.clock|runner identity)/i.test(normalized)&&
    /(?:missing|lack|not (?:present|provided|configured)|required|need)/i.test(normalized)){
   facts.push('This exact GitHub Actions runner already authenticated to Brain using OIDC and obtained an actual claim lease. Brain claim does not require a new BRAIN_LEASE_TOKEN secret. Preserve this verified claim, but do not infer unrelated write, deployment or wallet privileges.');
   matchedCodes.push('verified_brain_oidc');continue;
  }
  // An authenticated repository runner has already inspected GitHub's scoped
  // permissions before asking the model to plan. The model cannot replace
  // that evidence with a fictional repo-wide read-only policy. This ONLY
  // requests another evidence-grounded plan; it never grants a write.
  if(['owner_input_required','excluded_path_required'].includes(blocker.code)
      && writeScope?.reportedPushPermission===true
      && /^www-infinity4\/[A-Za-z0-9_.-]+$/.test(writeScope.repository||'')
      && reason.toLowerCase().includes(writeScope.repository.toLowerCase())
      && /(?:read[ -]?only|write permission|required to (?:create|write)|prohibit(?:s|ing)? (?:creation|modification)|(?:cannot|can't) (?:create|modify|write))/i.test(reason)
      && !/(?:\.env|\.git\/|secret|credential|authorization token|branch protection|403|401|sensitive path)/i.test(reason)){
   facts.push('The authenticated executor cloned '+writeScope.repository+
    ' and its GitHub repository metadata reported push permission. The scoped runtime excludes .git, .env, credentials and secrets, NOT the entire repository. Reassess source-only changes inside the assigned repository. This is not proof a future push, merge or deployment will succeed.');
   matchedCodes.push('verified_repo_write_scope');continue;
  }
  // The signed runner has a pinned local tree and owner-authorized source write
  // scope. An excluded-path claim about a *known local UI file* is evidence
  // for ONE bounded replan, not permission to change a missing/protected file.
  // Never infer write access to dependencies or bypass a real 401/403.
  if(blocker.code==='excluded_path_required'&&writeScope?.reportedPushPermission===true&&
    /^www-infinity4\/[A-Za-z0-9_.-]+$/.test(writeScope.repository||'')&&
    /(?:outside|excluded|forbidden|disallow|not permitted|prohibit)/i.test(reason)&&
    /(?:writ|path|source|scope|policy)/i.test(reason)&&
    !/(?:\.env|\.git[\\/]|secret|credential|authorization token|branch protection|403|401|permission denied|private endpoint)/i.test(reason)){
   const local=(Array.isArray(sourceTree)?sourceTree:[]).filter(p=>
    typeof p==='string'&&p.length<180&&
    /\.(?:js|mjs|cjs|ts|tsx|jsx|css|html|kt|java)$/.test(p)&&
    !p.split('/').some(part=>/^(?:\.git|\.env|node_modules|credentials|secrets?)$/i.test(part))&&
    reason.toLowerCase().includes(p.toLowerCase())).slice(0,5);
   if(local.length){
    facts.push('The authenticated runner checked out '+writeScope.repository+
     ', which reports push permission and contains these exact local source paths: '+local.join(', ')+
     '. The stated runner policy does not exclude these paths. Reconsider the source-only change for those files; a missing overlay file, third-party dependency, protected file or deployment requirement remains a real blocker. Pinned tree access does not prove a push, test or deployment will succeed.');
    matchedCodes.push('verified_local_source_path');continue;
   }
  }
  if(blocker.code!=='owner_input_required')continue;
  // The signed runner already cloned a scoped repository and supplied its file
  // tree. A reader cannot demand an owner-supplied file path instead of first
  // inspecting those actual files. Replan once; never silently drop blockers.
  if(CODE_LOCATION.test(reason)&&!PRIVATE_SCOPE.test(reason)){
   const candidates=sourceCandidates(sourceTree,request);
   if(candidates.length){
    facts.push('The authenticated repository checkout has these matching source paths: '+candidates.join(', ')+'. Inspect their current implementation and tests before demanding an owner-supplied path. Prefer a small reversible fix grounded in existing behavior, and preserve actual semantic ambiguity or conflicting requirements as blockers.');
    matchedCodes.push('existing_source_tree');continue;
   }
  }
  if(/Oracle Octaves/i.test(reason)&&/(?:mockups|CSS guidelines|design assets)/i.test(reason)&&/Oracle design/i.test(agentInstructions)&&/44 px/i.test(agentInstructions)&&/parchment/i.test(agentInstructions)&&!/\b(?:credentials|secret|authentication|endpoint|bindings)\b/i.test(reason)){
   facts.push('Pinned AGENTS.md already specifies Oracle design: '+trim(agentInstructions.slice(agentInstructions.indexOf('## Oracle design')).replace(/^## Oracle design\s*/, '').split(/\n## /)[0])+'. Inspect existing CSS and use those source rules. Missing mockups alone do not prevent a source-only implementation.');
   matchedCodes.push('existing_oracle_design');continue;
  }
  if(LABEL.test(reason)&&!EXPLICIT_LABEL.test(request)&&links.length){
   facts.push('Existing button labels are already in pinned source: '+links.slice(0,3).map(x=>trim(x.sourcePath)+': '+trim(x.id)+' = '+trim(x.label)).join('; ')+'. Preserve these labels unless the owner specified different wording.');
   matchedCodes.push('existing_label');continue;
  }
  if(DESTINATION.test(reason)&&!EXPLICIT_URL.test(request)&&links.length){
   const grounded=links.filter(x=>viewTargets.some(t=>t.url===x.siteUrl||t.url===x.href)&&viewTargets.some(t=>(t.url===x.siteUrl||t.url===x.href)&&Array.isArray(t.views)&&t.views.length>0&&t.views.every(v=>v.passed===true)));
   if(grounded.length){
    facts.push('Existing target link and anonymous public-browser response are both recorded: '+grounded.slice(0,3).map(x=>trim(x.href)).join('; ')+'. Preserve the existing destination unless a replacement was explicitly requested. HTTP success alone does not prove intended behavior.');
    matchedCodes.push('existing_live_destination');continue;
   }
  }
  if(RUNNER.test(reason)&&Array.isArray(scopedCapabilities.existingWorkflows)&&scopedCapabilities.existingWorkflows.length){
   facts.push('Existing scoped runner metadata is supplied in scopedCapabilities: '+scopedCapabilities.existingWorkflows.slice(0,4).map(x=>x.path).join(', ')+'; '+(scopedCapabilities.testCommands||[]).length+' test commands. Inspect before treating setup as missing. Workflow source changes follow the current owner authorization; credential values remain excluded.');
   matchedCodes.push('existing_workflow');continue;
  }
  if(DEPLOYMENT.test(reason)&&(!EXPLICIT_DEPLOY.test(request)||/\b(?:source.only|independently testable|ship actual source|source and tests)\b/i.test(request))){
   const browserOK=liveBrowser?.browserPassed===true;
   facts.push('Source-only code changes can be committed as committed_unverified after independent review/tests. '+(browserOK?'Anonymous public browser observations already exist. ':'')+'Neither that browser observation nor a source commit constitutes a production deployment. Do not demand deployment credentials for an independently testable source-only change; retain deployment as a separate unmet acceptance criterion if the owner explicitly requires it.');
   matchedCodes.push('source_only_deploy');continue;
  }
 }
 return {retry:matchedCodes.length>0,categories:[...new Set(matchedCodes)],
  instruction:matchedCodes.length?'Re-evaluate ONLY the blockers contradicted by the concrete evidence below. Produce a fresh complete JSON plan with real editable source files, subtasks, and tests only if independently implementable. Preserve other genuine blockers, all excluded-path restrictions, and any explicit owner acceptance requirements. Do not invent a new destination, deploy, privileged access, or treat the public browser as proof of a new release.':'',
  facts:facts.slice(0,6),originalBlockers:blockers.map(b=>({code:b.code,reason:trim(b.reason)})).slice(0,12)};
}



// A positive implementation plan also needs an evidence check. The signed
// Moltnook runner is the OIDC CLIENT; the QuantaPhi runner-auth.mjs module
// verifies INBOUND tokens on the Cloudflare Worker. A Green proposal cannot
// fix an already-verified claim by importing the Worker verifier across repos.
export function authPlanReconsideration({
 plan,writableRepository='',authenticatedAdapters=null,dependencyContext=null
}={}){
 const claim=authenticatedAdapters?.brain;
 const signedClaim=claim?.leaseClaimed===true&&
  Array.isArray(claim.verifiedCalls)&&claim.verifiedCalls.includes('claim')&&
  /GitHub Actions OIDC/i.test(String(claim.authentication||''));
 const remote=Array.isArray(dependencyContext?.repositories)?
  dependencyContext.repositories.find(r=>r.repository==='www-infinity4/QuantaPhi'&&r.status==='verified_read_only'):null;
 const hasQuantaVerifier=remote?.files?.some(f=>f.status==='verified_source'&&
  f.path==='workers/infinity-brain-clock/runner-auth.mjs')===true;
 const steps=[plan?.summary,...(plan?.requirements||[]),
  ...(plan?.subtasks||[]).flatMap(s=>[s?.task,s?.description])]
  .filter(x=>typeof x==='string');
 const findings=[];
 if(writableRepository!=='www-infinity4/QuantaPhi'){
  if(steps.some(s=>(/\b(?:import|require|load|copy)\b/i.test(s)&&
    /\brunner-auth\.mjs\b/i.test(s)&&/www-infinity4\/QuantaPhi|QuantaPhi repository/i.test(s))||
    (/authenticate\s*\(\s*request\s*\)/.test(s)&&/\brunner\.mjs\b/.test(s)))){
   findings.push('cross_repository_worker_auth_import');
  }
 }
 if(signedClaim&&steps.some(s=>/\bBRAIN_LEASE_TOKEN\b/i.test(s)&&
  /\b(?:add|configure|create|supply|provide|need|required|missing|lacks|provision)\b/i.test(s))){
  findings.push('verified_oidc_not_static_secret');
 }
 if(!findings.length)return {retry:false,categories:[],facts:[],instruction:''};
 const facts=[
  'Writable repository: '+String(writableRepository).slice(0,120)+'. A separate read-only QuantaPhi dependency snapshot is NOT a Node module dependency or permission to edit that repository.',
  ...(signedClaim?['The live GitHub Actions executor already obtained an authenticated Brain lease by OIDC. Verified calls: '+claim.verifiedCalls.filter(x=>['quant-audit','capability','claim'].includes(x)).join(', ')+'. No BRAIN_LEASE_TOKEN is required for that proven claim.']:[]),
  ...(hasQuantaVerifier?['Pinned QuantaPhi workers/infinity-brain-clock/runner-auth.mjs exists and verifies inbound Worker requests. It cannot be imported directly into a separate Moltnook GitHub Actions checkout.']:[])
 ];
 return {retry:true,categories:[...new Set(findings)],facts,
  instruction:'The previous implementation plan is contradicted by verified source/runtime facts. Build a new plan only for a real defect in the WRITABLE repository; no cross-repository runtime imports or invented secrets. A GitHub Actions runner sends OIDC bearer tokens via its existing call(step) path; the QuantaPhi Worker independently verifies inbound tokens. Do not add authenticate(request) to the Node runner. Do not reproduce old ticket error text as current truth. Prefer a focused local regression test or a small verified source change when warranted; if no change is justified, explain the existing implementation and preserve any genuinely unmet acceptance requirements as explicit blockers. Do not return an impossible implementation to Green.'};
}
