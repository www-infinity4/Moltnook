import test from 'node:test';
import assert from 'node:assert/strict';
import {SECTORS,routeSector,gradeOracleSource,evaluateWork,sectorFiles} from './bubbles-memory-pilot.mjs';
test('private memory sectors are fixed and non-overlapping',()=>{
 assert.deepEqual(SECTORS.map(x=>x.kind),['index','scripts','conversations','people']);
 assert.equal(new Set(SECTORS.map(x=>x.name)).size,4);
 assert.ok(SECTORS.every(x=>x.name.startsWith('Bubbles-Memory-')));
});
test('natural language routes by meaningful sector without needing commands',()=>{
 assert.equal(routeSector('Remember the Python README repair'),'scripts');
 assert.equal(routeSector('Last conversation from yesterday'),'conversations');
 assert.equal(routeSector('My brother and our dog'),'people');
 assert.equal(routeSector('Show memories about astronomy'),'index');
});
test('sector repositories contain only synthetic references and explicit privacy policy',()=>{
 for(const item of SECTORS){
  const files=sectorFiles(item.kind);
  assert.ok(files['README.md'].includes('private'));
  assert.ok(files['skills/README.md'].includes('verified owner-scoped'));
  const schema=JSON.parse(files['schema/memory-reference.schema.json']);
  assert.equal(schema.policy.realUserDataInGit,false);
  assert.equal(schema.policy.crossUserReads,'forbidden');
  assert.equal(schema.policy.transcriptsInGit,'forbidden unless separately designed, encrypted and owner-approved');
  assert.equal(JSON.parse(files['examples/synthetic-memory.json']).owner,'synthetic');
  assert.ok(Object.keys(files).length>=4);
 }
});
test('Oracle grader scores source evidence, never invents rendering or actual click',()=>{
 const good='<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><style>body{background:#f7f4f0;color:#312722}.card{background:#fff}button{color:#b83b32}</style><main><article class="card">One</article><article class="card">Two</article><button id="act">Go</button><span id="status"></span><script>document.querySelector("#act").addEventListener("click",()=>{document.querySelector("#status").textContent="clicked"})</script></main></html>';
 const grade=gradeOracleSource(good);
 assert.equal(grade.score,100);
 assert.equal(grade.rendered,false);
 assert.equal(grade.buttonClicked,false);
 assert.equal(grade.deployVerified,false);
 assert.ok(grade.criteria.every(x=>x.passed));
 const bad=gradeOracleSource('I built and deployed a perfect Oracle page with working buttons');
 assert.ok(bad.score<50);
 assert.equal(gradeOracleSource('body{background:pink}').criteria.at(-1).passed,false);
});
test('spoken tool activity without receipt earns no actual-execution credit',()=>{
 const s=evaluateWork({claimedAction:true});
 assert.equal(s.actionGrade,0);
 assert.equal(s.reason,'spoken_action_without_execution_receipt');
 assert.equal(evaluateWork({claimedAction:true,receipt:{ok:true,completed:true,targetObserved:true}}).actionGrade,100);
 assert.equal(evaluateWork({claimedAction:true,receipt:{ok:true,completed:false,targetObserved:false}}).actionGrade,0);
});
test('grader feedback is a rubric and not a live visual proof',()=>{
 const f=sectorFiles('index',{evaluation:gradeOracleSource('plain answer')});
 const rubric=JSON.parse(f['grading/oracle-code-rubric.json']);
 assert.equal(rubric.requiresSeparateBrowserProof,true);
 assert.equal(rubric.requiresActualToolReceiptForActions,true);
 assert.equal(JSON.parse(f['grading/smoke-evaluation.json']).rendered,false);
});
