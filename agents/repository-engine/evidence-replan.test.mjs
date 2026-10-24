import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceReplanFeedback,authPlanReconsideration,deliveryPlanFeedback} from './evidence-replan.mjs';
test('content job receipt gets a reader destination replan before Green edits',()=>{
 const plan={summary:'Investigate Group Build, then create original scenario recommendations.',
  files:['docs/GROUP_BUILD_BRAIN_BRIEF.md','group-story.js'],blockers:[],
  notes:['This job is purely investigative and content-generation; no code changes or deployments are required.','No write access is needed.']};
 const scope={repository:'www-infinity4/QuantaPhi',reportedPushPermission:true};
 const result=deliveryPlanFeedback({plan,writeScope:scope});
 assert.equal(result.retry,true);
 assert.equal(result.permissionsExpanded,false);
 assert.match(result.instruction,/editable-path allowlist/);
 assert.match(result.instruction,/null source contract/);
 assert.deepEqual(plan.files,['docs/GROUP_BUILD_BRAIN_BRIEF.md','group-story.js']);
 assert.equal(deliveryPlanFeedback({plan,writeScope:{...scope,reportedPushPermission:false}}).retry,false);
 assert.equal(deliveryPlanFeedback({plan:{...plan,blockers:[{code:'owner_input_required',reason:'Private source unavailable'}]},writeScope:scope}).retry,false);
 assert.equal(deliveryPlanFeedback({plan:{...plan,summary:'Fix Android announcement receipt logic',notes:['Hardware validation remains separate.']},writeScope:scope}).retry,false);
 assert.equal(deliveryPlanFeedback({plan:{...plan,notes:'invalid'},writeScope:scope}).retry,false);
});
const links=[{id:'shoplcShirtButton',label:'ShopLC Live channel',href:'https://quantaphi.org/shoplc/',siteUrl:'https://quantaphi.org/shoplc/',sourcePath:'index.html'}];
const browser={browserPassed:true,targets:[{url:'https://quantaphi.org/',views:[{passed:true},{passed:true}]},{url:'https://quantaphi.org/shoplc/',views:[{passed:true}]}]};
const capability={existingWorkflows:[{path:'.github/workflows/brain-writer.yml'}],testCommands:['node --test test/brain-writer.test.mjs']};
const b=(code,reason)=>({code,reason});
test('pinned Oracle rules justify one reconsideration while private backend blockers remain',()=>{
 const plan={blockers:[b('owner_input_required','Owner must supply Oracle Octaves design assets and CSS guidelines'),b('owner_input_required','Owner must provide backend endpoint authentication credentials')]};
 const r=evidenceReplanFeedback({plan,agentInstructions:'## Oracle design\nStyle uses parchment canvas and 44 px hit targets.\n\nOther rules.'});
 assert.deepEqual(r.categories,['existing_oracle_design']);
 assert.equal(r.originalBlockers.length,2);
 assert.match(r.facts[0],/parchment/);
 assert.equal(evidenceReplanFeedback({plan}).retry,false);
});
test('ShopLC source and public browser proof elicit one non-privileged reader reconsideration',()=>{
 const p={blockers:[
  b('owner_input_required','Exact button label text (main and sub) that the owner expects has not been provided.'),
  b('owner_input_required','Exact destination URL for shoplc button has not been provided.'),
  b('owner_input_required','Cloudflare deployment details (account ID, API token, worker name/D1 DB ID, health-check URL) are missing.')
 ]};
 const r=evidenceReplanFeedback({plan:p,task:'Fix shoplc button on quantaphi',linkFacts:links,liveBrowser:browser,scopedCapabilities:capability});
 assert.equal(r.retry,true);
 assert.deepEqual(r.categories,['existing_label','existing_live_destination','source_only_deploy']);
 assert.match(r.facts.join(' '),/ShopLC Live channel/);
 assert.match(r.facts.join(' '),/https:\/\/quantaphi.org\/shoplc\//);
 assert.ok(!r.facts.join(' ').includes('proof of a new release'));
 assert.equal(p.blockers.length,3,'original blockers must not be altered');
});
test('do not invent working links from failed browser observations',()=>{
 const r=evidenceReplanFeedback({plan:{blockers:[b('owner_input_required','Exact destination URL has not been provided')]},task:'Fix ShopLC',linkFacts:links,
  liveBrowser:{browserPassed:false,targets:[{url:'https://quantaphi.org/shoplc/',views:[{passed:false}]}]}});
 assert.equal(r.retry,false);
});
test('explicit rename, replacement URL or deploy requirements must remain legitimate blockers',()=>{
 for(const [request,reason] of [
  ['Rename ShopLC button to the owner preferred new text','Exact button label text from owner has not been provided'],
  ['Change the destination link to https://example.org/unknown','Exact destination URL was not provided'],
  ['Deploy the new ShopLC worker','Cloudflare deployment account ID API token missing']
 ]){
  const r=evidenceReplanFeedback({plan:{blockers:[b('owner_input_required',reason)]},task:request,linkFacts:links,liveBrowser:browser});
  assert.equal(r.retry,false,request);
 }
});
test('protected path blockers never trigger unsafe bypass',()=>{
 const p={blockers:[b('excluded_path_required','Changes to .github/workflows/brain-writer.yml are disallowed')]};
 const r=evidenceReplanFeedback({plan:p,task:'Create new deployment workflow',scopedCapabilities:capability});
 assert.equal(r.retry,false);
 assert.deepEqual(p.blockers[0].code,'excluded_path_required');
});
test('scoped workflow evidence supports reconsidering missing runner but not granting writes',()=>{
 const p={blockers:[b('owner_input_required','Missing concrete scoped runner definition and test suite entry point')]};
 const r=evidenceReplanFeedback({plan:p,task:'Give repository a scoped runner',scopedCapabilities:capability});
 assert.equal(r.retry,true);
 assert.deepEqual(r.categories,['existing_workflow']);
 assert.match(r.facts[0],/current owner authorization/);
 assert.equal(p.blockers.length,1);
});
test('unknown or actual inaccessible blockers are preserved for owner',()=>{
 const p={blockers:[b('owner_input_required','Need private third-party API key'),b('unsupported_acceptance','No sandbox adapter installed')]};
 const r=evidenceReplanFeedback({plan:p,task:'Connect outside API'});
 assert.equal(r.retry,false);
 assert.equal(r.originalBlockers.length,2);
});


test('explicit source-and-tests work proceeds while deployment stays pending',()=>{
 const plan={blockers:[{code:'owner_input_required',reason:'Cloudflare D1 and deployment credentials missing'}]};
 const r=evidenceReplanFeedback({plan,task:'Ship actual source and tests; deployment stays blocked until its adapter is available.'});
 assert.equal(r.retry,true);assert.deepEqual(r.categories,['source_only_deploy']);assert.equal(r.originalBlockers.length,1);
});


test('reader must look in authenticated Robot Brain source before asking owner for file paths',()=>{
 const plan={blockers:[b('owner_input_required','The owner request does not specify the exact definition of old tickets vs run tickets, desired UI behavior (filter, toggle, sorting), or which files should be modified.')]};
 const sourceTree=['robot-directions.js','robot-directions.css','bubbles-ai.js','.github/workflows/brain-writer.yml','test/robot-directions.test.mjs'];
 const r=evidenceReplanFeedback({plan,task:'Fix the robot brain directions area showing old tickets instead of tickets I want to run',sourceTree});
 assert.equal(r.retry,true);
 assert.deepEqual(r.categories,['existing_source_tree']);
 assert.match(r.facts[0],/robot-directions\.js/);
 assert.doesNotMatch(r.facts[0],/\.github\/workflows|test\/robot-directions/);
 assert.equal(plan.blockers.length,1,'no blocker is automatically erased');
});
test('source suggestions never invent files or bypass missing private access',()=>{
 const plan={blockers:[b('owner_input_required','An API token or secret credential is needed for the endpoint and the source component is unknown.')]};
 const r=evidenceReplanFeedback({plan,task:'Deploy the Bubbles reader to the protected endpoint',sourceTree:['bubbles-ai.js']});
 assert.equal(r.retry,false);
 const unknown=evidenceReplanFeedback({plan:{blockers:[b('owner_input_required','Which source files should be modified?')]},task:'Fix new device component',sourceTree:['unrelated.js','.env','test/new-device.test.mjs']});
 assert.equal(unknown.retry,false);
});


test('verified cross-repository runner scope triggers bounded replan of invented read-only policy',()=>{
 const plan={blockers:[
  b('owner_input_required','Write permission on the www-infinity4/WidgetPhi repository is required to create the recommendation report.'),
  b('excluded_path_required','The runtime policy marks the www-infinity4/WidgetPhi repository as read-only, prohibiting creation or modification of any files.')
 ]};
 const scope={repository:'www-infinity4/WidgetPhi',reportedPushPermission:true};
 const r=evidenceReplanFeedback({plan,task:'Make a WidgetPhi recommendation report from source evidence',writeScope:scope});
 assert.equal(r.retry,true);
 assert.deepEqual(r.categories,['verified_repo_write_scope']);
 assert.match(r.facts.join(' '),/reported push permission/);
 assert.match(r.facts.join(' '),/not proof a future push/);
 assert.equal(plan.blockers.length,2,'the returned blockers remain available for review');
});
test('unverified push access or protected paths never grant repo writes via the reader',()=>{
 const p={blockers:[b('excluded_path_required','The runtime policy marks the www-infinity4/WidgetPhi repository as read-only')]};
 const scoped={repository:'www-infinity4/WidgetPhi',reportedPushPermission:true};
 assert.equal(evidenceReplanFeedback({plan:p,writeScope:{...scoped,reportedPushPermission:false}}).retry,false);
 assert.equal(evidenceReplanFeedback({plan:p,writeScope:{...scoped,repository:'www-infinity4/OtherRepo'}}).retry,false);
 assert.equal(evidenceReplanFeedback({plan:{blockers:[b('excluded_path_required','The .env secret file in www-infinity4/WidgetPhi is read-only')]},writeScope:scoped}).retry,false);
});

test('pinned QuantaPhi files and successful OIDC claim contradict invented Red-Brain connection blockers',()=>{
 const deps={repositories:[{repository:'www-infinity4/QuantaPhi',status:'verified_read_only',files:[
  {path:'workers/infinity-brain-clock/worker.js',status:'verified_source',blobSha:'a'.repeat(40)},
  {path:'workers/infinity-brain-clock/runner-auth.mjs',status:'verified_source',blobSha:'b'.repeat(40)},
  {path:'scripts/brain-writer.mjs',status:'verified_source',blobSha:'c'.repeat(40)}
 ]}]};
 const authenticatedAdapters={brain:{authentication:'GitHub Actions OIDC audience infinity-brain-writer',
  verifiedCalls:['quant-audit','capability','claim'],leaseClaimed:true}};
 const plan={blockers:[
  b('owner_input_required','The required source files workers/infinity‑brain‑clock/worker.js, runner‑auth.mjs, and scripts/brain-writer.mjs are not present in the current read-only snapshot of www-infinity4/QuantaPhi.'),
  b('owner_input_required','Moltnook lacks BRAIN_LEASE_TOKEN (or an OIDC-based token provider) required for Brain-Clock lease adapter.')
 ]};
 const r=evidenceReplanFeedback({plan,task:'Repair Robot Brain source routing in QuantaPhi',dependencyContext:deps,authenticatedAdapters});
 assert.equal(r.retry,true);
 assert.deepEqual(r.categories,['verified_dependency_source','verified_brain_oidc']);
 assert.match(r.facts.join(' '),/runner-auth\.mjs/);
 assert.match(r.facts.join(' '),/already authenticated/);
 assert.equal(plan.blockers.length,2,'evidence causes replan, not automatic silent approval');
});
test('no source or OIDC assertion without pinned read and actual runner claim',()=>{
 const plan={blockers:[
  b('owner_input_required','workers/infinity-brain-clock/worker.js missing in www-infinity4/QuantaPhi'),
  b('owner_input_required','Missing BRAIN_LEASE_TOKEN for the Brain-Clock runner'),
  b('owner_input_required','Wallet API credential is missing'),
 ]};
 const deps={repositories:[{repository:'www-infinity4/QuantaPhi',status:'blocked',files:[{path:'workers/infinity-brain-clock/worker.js',status:'verified_source'}]}]};
 const unclaimed={brain:{authentication:'GitHub Actions OIDC',verifiedCalls:['capability'],leaseClaimed:false}};
 const r=evidenceReplanFeedback({plan,dependencyContext:deps,authenticatedAdapters:unclaimed});
 assert.equal(r.retry,false);
 assert.deepEqual(r.categories,[]);
});


test('exact Task-4 plan cannot import a Worker-side QuantaPhi JWT verifier into Moltnook',()=>{
 const report={plan:{
  summary:'Repair the source routing failure. The QuantaPhi files exist and OIDC authentication is verified.',
  requirements:[
   'Add a correct import of runner-auth.mjs from the www‑infinity4/QuantaPhi repository into agents/repository-engine/runner.mjs.',
   'Update the request handling in runner.mjs to call authenticate(request) and reject unauthenticated calls.',
   'Add a focused test for JWT verification.'
  ],blockers:[],files:['agents/repository-engine/runner.mjs','agents/repository-engine/runner-auth.test.mjs']
 }};
 const authenticatedAdapters={brain:{authentication:'GitHub Actions OIDC audience infinity-brain-writer',
   verifiedCalls:['quant-audit','capability','claim'],leaseClaimed:true}};
 const dependencyContext={repositories:[{repository:'www-infinity4/QuantaPhi',status:'verified_read_only',files:[
  {path:'workers/infinity-brain-clock/runner-auth.mjs',status:'verified_source',blobSha:'1'.repeat(40)}
 ]}]};
 const r=authPlanReconsideration({plan:report.plan,writableRepository:'www-infinity4/Moltnook',authenticatedAdapters,dependencyContext});
 assert.equal(r.retry,true);
 assert.deepEqual(r.categories,['cross_repository_worker_auth_import']);
 assert.match(r.instruction,/no cross-repository runtime imports/);
 assert.match(r.facts.join(' '),/authenticated Brain lease/);
 assert.match(r.facts.join(' '),/inbound Worker requests/);
 assert.equal(report.plan.blockers.length,0,'must detect invalid implementation despite no reported blockers');
});
test('signed OIDC Brain lease supersedes a fabricated static BRAIN_LEASE_TOKEN requirement',()=>{
 const plan={requirements:['Configure BRAIN_LEASE_TOKEN for Moltnook repository to claim a Brain-Clock lease.']};
 const c={brain:{authentication:'GitHub Actions OIDC',leaseClaimed:true,verifiedCalls:['claim']}};
 const r=authPlanReconsideration({plan,writableRepository:'www-infinity4/Moltnook',authenticatedAdapters:c});
 assert.deepEqual(r.categories,['verified_oidc_not_static_secret']);
 assert.ok(r.facts.join(' ').includes('No BRAIN_LEASE_TOKEN is required'));
 assert.equal(authPlanReconsideration({plan,writableRepository:'www-infinity4/Moltnook',
  authenticatedAdapters:{brain:{...c.brain,leaseClaimed:false}}}).retry,false,'unverified OIDC cannot veto an actual missing credential');
});
test('a legitimate local runner test passes, without granting cross-repository writes',()=>{
 const c={brain:{authentication:'GitHub Actions OIDC',leaseClaimed:true,verifiedCalls:['claim']}};
 const plan={summary:'Unit-test a local OIDC request bridge in Moltnook.',requirements:[
  'Add a test to agents/repository-engine/credential-bridge.test.mjs to reject unauthenticated GitHub write operations.',
  'Do not import external QuantaPhi modules; preserve the source-only review gate.'
 ]};
 const r=authPlanReconsideration({plan,writableRepository:'www-infinity4/Moltnook',authenticatedAdapters:c});
 assert.equal(r.retry,false);
 assert.deepEqual(r.categories,[]);
});


test('pinned UI source path contradicts invented blanket exclusion without granting extra permissions',()=>{
 const repo='www-infinity4/QuantaPhi';
 const plan={blockers:[b('excluded_path_required','Bubbles UI source bubbles-voice-gate.js is outside writer policy; editing this source path is not permitted')]};
 const evidence={plan,task:'Fix Bubbles voice gating',writeScope:{repository:repo,reportedPushPermission:true},
  sourceTree:['bubbles-voice-gate.js','test/bubbles-voice-gate.test.cjs','README.md']};
 const reconsider=evidenceReplanFeedback(evidence);
 assert.equal(reconsider.retry,true);
 assert.deepEqual(reconsider.categories,['verified_local_source_path']);
 assert.match(reconsider.facts.join(' '),/bubbles-voice-gate.js/);
 assert.equal(plan.blockers.length,1,'original blocker is not removed without model replan');
 assert.equal(evidenceReplanFeedback({...evidence,writeScope:{repository:repo,reportedPushPermission:false}}).retry,false);
 assert.equal(evidenceReplanFeedback({...evidence,sourceTree:['README.md']}).retry,false);
 assert.equal(evidenceReplanFeedback({...evidence,plan:{blockers:[b('excluded_path_required','Android overlay source bubbles-floating-window.js is forbidden by writer policy')]}}).retry,false,'missing file must stay blocked');
 assert.equal(evidenceReplanFeedback({...evidence,plan:{blockers:[b('excluded_path_required','The .env credentials source is outside writer policy')]},sourceTree:['.env']}).retry,false);
});


test('reader must obtain exact before literal from pinned own source, not make owner supply code',()=>{
 const reason='The edit must match an immutable source window. Provide the exact before snippet (a few lines surrounding repositoryFor) from bubbles-brain-actions.js.';
 const base={plan:{blockers:[b('owner_input_required',reason)]},
  task:'Fix repositoryFor selection in Bubbles',
  sourceTree:['bubbles-brain-actions.js','test/bubbles-brain-actions.test.cjs','README.md'],
  writeScope:{repository:'www-infinity4/QuantaPhi',reportedPushPermission:true}};
 const retry=evidenceReplanFeedback(base);
 assert.equal(retry.retry,true);
 assert.deepEqual(retry.categories,['verified_pinned_before_source']);
 assert.match(retry.facts.join(' '),/SHA-256-pinned bounded source windows/);
 assert.equal(base.plan.blockers.length,1);
 assert.equal(evidenceReplanFeedback({...base,sourceTree:['README.md']}).retry,false,'no invented file');
 assert.equal(evidenceReplanFeedback({...base,writeScope:{...base.writeScope,reportedPushPermission:false}}).retry,false,'permission remains necessary');
 assert.equal(evidenceReplanFeedback({...base,plan:{blockers:[b('owner_input_required','Please provide exact before snippet from .env for repair')]},sourceTree:['.env']}).retry,false,'secrets excluded');
});

test('public Quick Card source work is not blocked solely by publisher API credentials',()=>{
 const plan={blockers:[b('owner_input_required','API credentials or confirmed public-access endpoints for TradingView, Zillow, SEC EDGAR, F-Droid and Reddit are not present')]};
 const r=evidenceReplanFeedback({plan,task:'Build public source Quick Cards and test original provider links'});
 assert.equal(r.retry,true);
 assert.deepEqual(r.categories,['public_quick_card_source']);
 assert.match(r.facts.join(' '),/separately blocked integration/);
 assert.equal(plan.blockers.length,1);
 assert.equal(evidenceReplanFeedback({plan,task:'Integrate a licensed authenticated exchange trading API'}).retry,false);
});
test('claimed Brain lease beats unrelated ChatGPT Cloudflare plugin scope complaint for source-only cards',()=>{
 const plan={blockers:[b('owner_input_required','Cloudflare ChatGPT connector lacks Workers D1 DO OAuth scopes; need owner authorization')]};
 const owned={brain:{leaseClaimed:true,verifiedCalls:['quant-audit','capability','claim']}};
 const task='Build Quick Cards in QuantaPhi source';
 const r=evidenceReplanFeedback({plan,task,authenticatedAdapters:owned});
 assert.deepEqual(r.categories,['independent_brain_credential']);
 assert.match(r.facts.join(' '),/deployment credentials/);
 assert.ok(!evidenceReplanFeedback({plan,task,authenticatedAdapters:{}}).categories.includes('independent_brain_credential'),'No signed claim means that particular evidence cannot be asserted');
});
test('existing checked-out card source redirects missing repository map demand to public PR evidence',()=>{
 const plan={blockers:[b('owner_input_required','Missing repository map and CI failure logs for merged PR #974 and draft PR #975')]};
 const scoped={repository:'www-infinity4/QuantaPhi',reportedPushPermission:true};
 const task='Reconcile the existing source Quick Cards #974 and #975, build more cards';
 const r=evidenceReplanFeedback({plan,task,sourceTree:['source-quick-cards.mjs'],writeScope:scoped});
 assert.deepEqual(r.categories,['quick_card_repository_evidence']);
 assert.match(r.facts.join(' '),/Do not claim existing PR status/);
 assert.equal(evidenceReplanFeedback({plan,task,sourceTree:[],writeScope:scoped}).retry,false);
});
