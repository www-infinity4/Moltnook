import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceReplanFeedback} from './evidence-replan.mjs';
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
 const r=evidenceReplanFeedback({plan,task:'Fix the Bubbles reader',sourceTree:['bubbles-ai.js']});
 assert.equal(r.retry,false);
 const unknown=evidenceReplanFeedback({plan:{blockers:[b('owner_input_required','Which source files should be modified?')]},task:'Fix new device component',sourceTree:['unrelated.js','.env','test/new-device.test.mjs']});
 assert.equal(unknown.retry,false);
});
