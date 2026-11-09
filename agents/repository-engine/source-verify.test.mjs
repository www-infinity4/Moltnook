import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReviewEligibility,verifiedSourceReviewPlan,runSourceReview,discoverExistingSourceTests} from './source-verify.mjs';
const sourceSha='b'.repeat(40),mergeSha='a'.repeat(40),headSha='c'.repeat(40),repository='www-infinity4/QuantaPhi';
const job={agent:'pink-panther',repository,instructions:'After TASK-1, independently verify the owner routing'};
const sourceReview={kind:'source_review_only',repository,mergeSha,sourceCommitSha:sourceSha,
 primaryId:'TASK-1',prNumber:418,prUrl:'https://github.com/www-infinity4/QuantaPhi/pull/418',mayWrite:false};
const capability={sourceReviewV1:true};
const pr={merged:true,merge_commit_sha:mergeSha,head:{sha:sourceSha},
 base:{ref:'main',repo:{full_name:repository}},title:'Robot review: IW-20261016-706B1494/TASK-1'};
const changedPaths=['bubbles-brain-actions.js','test/bubbles-brain-actions.test.cjs'];
test('existing merged Green source routes independently to Pink, with source-only proof',()=>{
 const plan=verifiedSourceReviewPlan({job,sourceReview,capability,pr,changedPaths,headSha});
 assert.equal(plan.prNumber,418);
 assert.deepEqual(plan.testPaths,['test/bubbles-brain-actions.test.cjs']);
 assert.equal(plan.sourceReviewOnly,true);
 assert.equal(plan.productionVerified,false);
});
test('no capability, scope, foreign repository, missing merge or fraudulent test path may activate review',()=>{
 for(const c of [{},{sourceReviewV1:false}])
  assert.equal(sourceReviewEligibility({job,sourceReview,capability:c}).eligible,false);
 assert.equal(sourceReviewEligibility({job:{...job,agent:'greenbeans'},sourceReview,capability}).eligible,false);
 assert.equal(sourceReviewEligibility({job,sourceReview:{...sourceReview,mayWrite:true},capability}).eligible,false);
 for(const bad of [{merged:false},{merge_commit_sha:headSha},{head:{sha:'not-head'}},
  {base:{ref:'dev',repo:{full_name:repository}}},{title:'Unrelated bot change'}])
  assert.throws(()=>verifiedSourceReviewPlan({job,sourceReview,capability,pr:{...pr,...bad},changedPaths,headSha}),/provenance_invalid/);
 assert.throws(()=>verifiedSourceReviewPlan({job,sourceReview,capability,pr,changedPaths:['test/unknown.test.cjs'],headSha}),/source_paths_missing/);
 assert.throws(()=>verifiedSourceReviewPlan({job,sourceReview,capability,pr,changedPaths:['README.md'],headSha}),/test_paths_missing/);
 assert.throws(()=>verifiedSourceReviewPlan({job,sourceReview,capability,pr,changedPaths:['index.html','../../secrets.test.cjs'],headSha}),/test_paths_missing/);
});
test('source review checks trusted ancestry before it runs focused repository tests',async()=>{
 const calls=[];
 const receipt=await runSourceReview({
  job,sourceReview,capability,headSha,
  github:async path=>{calls.push(['github',path]);return path.endsWith('/files?per_page=100')
   ?changedPaths.map(filename=>({filename})):pr},
  readSource:async path=>{calls.push(['read',path]);return 'test code'},
  verifyAncestry:async sha=>{calls.push(['ancestry',sha]);},
  runTest:async path=>{calls.push(['test',path]);return 'TAP version 13\n# pass 4';}
 });
 assert.deepEqual(calls.slice(2),[['ancestry',mergeSha],['read','test/bubbles-brain-actions.test.cjs'],['test','test/bubbles-brain-actions.test.cjs']]);
 assert.equal(receipt.status,'source_verified');
 assert.equal(receipt.testsPassed,true);
 assert.equal(receipt.noNewSourceWrites,true);
 assert.equal(receipt.noRewards,true);
 assert.equal(receipt.productionVerified,false);
 assert.equal(receipt.mergedNewCode,false);
});
test('missing real tests or failed ancestry refuses a false receipt',async()=>{
 await assert.rejects(runSourceReview({
  job,sourceReview,capability,headSha,
  github:async url=>url.endsWith('/files?per_page=100')?changedPaths.map(filename=>({filename})):pr,
  readSource:async()=>'',verifyAncestry:async()=>{},runTest:()=>assert.fail('missing test')
 }),/test_source_missing/);
 await assert.rejects(runSourceReview({
  job,sourceReview,capability,headSha,
  github:async url=>url.endsWith('/files?per_page=100')?changedPaths.map(filename=>({filename})):pr,
  readSource:()=>assert.fail('unverified source'),verifyAncestry:async()=>{throw Error('not_an_ancestor');},
  runTest:()=>assert.fail('unverified test')
 }),/not_an_ancestor/);
});


test('merged-source Pink review runs existing tracked test files that import the changed source',async()=>{
 const scenarios=[
  {repository:'www-infinity4/QuantaPhi',changed:'source-quick-cards.mjs',
   testPath:'test/source-quick-cards.test.mjs',
   source:"import {findSourceCard} from '../source-quick-cards.mjs';"},
  {repository:'www-infinity4/TV-Database',changed:'js/youtube-only-catalog.js',
   testPath:'tests/playback-catalog.test.js',
   source:'const gate = fs.readFileSync("js/youtube-only-catalog.js","utf8");'}
 ];
 for(const c of scenarios){
  const calls=[];
  const actualJob={...job,repository:c.repository};
  const actualReview={...sourceReview,repository:c.repository};
  const actualPr={...pr,base:{ref:'main',repo:{full_name:c.repository}}};
  const receipt=await runSourceReview({
   job:actualJob,sourceReview:actualReview,capability,headSha,
   trackedTestPaths:[c.testPath,'tests/unrelated.test.js'],
   github:async url=>url.includes('/files?')?[{filename:c.changed}]:actualPr,
   readSource:async path=>{
    calls.push(['read',path]);
    return path===c.testPath?c.source:"import '../other-module.js';";
   },
   verifyAncestry:async sha=>{calls.push(['ancestry',sha]);},
   runTest:async path=>{calls.push(['test',path]);return 'TAP version 13\n# pass 1';}
  });
  assert.equal(receipt.status,'source_verified');
  assert.deepEqual(receipt.testPaths,[c.testPath]);
  assert.deepEqual(calls.filter(x=>x[0]==='test'),[['test',c.testPath]]);
  assert.equal(receipt.productionVerified,false);
  assert.equal(receipt.mergedNewCode,false);
  assert.equal(receipt.noRewards,true);
 }
});
test('read-only fallback rejects unrelated, missing, unsafe and untracked tests instead of claiming Pink approval',async()=>{
 const data={job,sourceReview,capability,headSha,
  github:async url=>url.includes('/files?')?[{filename:'source-quick-cards.mjs'}]:pr,
  verifyAncestry:async()=>{},runTest:async()=>assert.fail('test cannot run without a grounded source link')};
 for(const tc of [
  {trackedTestPaths:[],source:"import '../source-quick-cards.mjs';"},
  {trackedTestPaths:['test/unrelated.test.mjs'],source:"import '../unrelated-source.mjs';"},
  {trackedTestPaths:['../test/source-quick-cards.test.mjs'],source:"import '../source-quick-cards.mjs';"}
 ]){
  await assert.rejects(runSourceReview({...data,trackedTestPaths:tc.trackedTestPaths,
   readSource:async()=>tc.source}),/merged_source_review_test_paths_missing/);
 }
});


test('production source review supplies the git-tracked test inventory rather than an unverified model list',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
 assert.match(source,/trackedTestPaths:\s*git\('ls-files'\)\.split\('\\n'\)/);
});


test('Pink never treats comments or unrelated string text as executable source references',async()=>{
 const changedPaths=['lib/gate.mjs'];
 const sample=[
  "// import '../lib/gate.mjs';",
  "/* import '../lib/gate.mjs'; */",
  "const message = \"import '../lib/gate.mjs'\";",
  "const url = 'https://example.test/lib/gate.mjs';",
  "const url2 = \"// import '../lib/gate.mjs'\";"
 ].join('\n');
 const selected=await discoverExistingSourceTests({changedPaths,
  trackedTestPaths:['tests/legacy/fake.test.mjs'],
  readSource:async()=>sample});
 assert.deepEqual(selected,[]);
});
test('Pink resolves ESM imports from the test directory and fs.readFileSync from the working root',async()=>{
 const changedPaths=['lib/gate.mjs'];
 const files={
  'lib/gate.test.mjs':"import './gate.mjs';",
  'tests/legacy/gate.test.mjs':"import '../lib/gate.mjs';",
  'tests/gate-reader.test.mjs':'const gate=fs.readFileSync("lib/gate.mjs","utf8");',
  'tests/gate-url.test.mjs':"const gate=readFileSync(new URL('../lib/gate.mjs',import.meta.url),'utf8');"
 };
 const selected=await discoverExistingSourceTests({changedPaths,
  trackedTestPaths:Object.keys(files),
  readSource:async path=>files[path]});
 assert.deepEqual(selected,[
  'lib/gate.test.mjs','tests/gate-reader.test.mjs','tests/gate-url.test.mjs'
 ]);
});
test('Pink rejects a file-read URL resolved from another base, not import.meta.url',async()=>{
 const selected=await discoverExistingSourceTests({changedPaths:['lib/gate.mjs'],
  trackedTestPaths:['tests/fake.test.mjs'],
  readSource:async()=>'const text=readFileSync(new URL("../../lib/gate.mjs","https://other.test/base/"))'});
 assert.deepEqual(selected,[]);
});
