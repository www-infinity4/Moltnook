import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReviewEligibility,verifiedSourceReviewPlan,runSourceReview} from './source-verify.mjs';
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
test('run source review performs real git ancestry and focused Node tests only; no write, commit, or payouts',async()=>{
 const calls=[];
 const receipt=await runSourceReview({
  job,sourceReview,capability,headSha,
  github:async path=>{calls.push(['github',path]);return path.endsWith('/files?per_page=100')
   ?changedPaths.map(filename=>({filename})):pr},
  readSource:async path=>{calls.push(['read',path]);return 'test code'},
  runCommand:async(cmd,args)=>{calls.push([cmd,...args]);return 'TAP version 13\n# pass 4';}
 });
 assert.deepEqual(calls.filter(a=>a[0]==='git'),[['git','merge-base','--is-ancestor',mergeSha,'HEAD']]);
 assert.deepEqual(calls.filter(a=>a[0]==='node'),[['node','--test','test/bubbles-brain-actions.test.cjs']]);
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
  readSource:async()=>'',runCommand:async()=>''
 }),/test_source_missing/);
 await assert.rejects(runSourceReview({
  job,sourceReview,capability,headSha,
  github:async url=>url.endsWith('/files?per_page=100')?changedPaths.map(filename=>({filename})):pr,
  readSource:async()=>'',runCommand:async(cmd)=>{if(cmd==='git')throw Error('not_an_ancestor');}
 }),/not_an_ancestor/);
});
