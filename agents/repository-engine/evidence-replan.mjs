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
export function evidenceReplanFeedback({plan,task='',ownerRequest='',linkFacts=[],liveBrowser,scopedCapabilities={},agentInstructions=''}={}){
 const blockers=Array.isArray(plan?.blockers)?plan.blockers:[];
 const request=String(task||'')+' '+String(ownerRequest||'');
 const facts=[],matchedCodes=[];
 const links=(Array.isArray(linkFacts)?linkFacts:[]).filter(x=>x&&typeof x.href==='string'&&typeof x.label==='string'&&x.href.length<400&&x.label.length<170).slice(0,5);
 const viewTargets=Array.isArray(liveBrowser?.targets)?liveBrowser.targets:[];
 for(const blocker of blockers){
  if(!blocker||blocker.code!=='owner_input_required'||typeof blocker.reason!=='string')continue;
  const reason=blocker.reason;
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

