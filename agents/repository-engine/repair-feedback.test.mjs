import test from 'node:test';
import assert from 'node:assert/strict';
import {repairWithFeedback} from './repair-feedback.mjs';
test('malformed build replies preserve earlier independent review findings',async()=>{
 let calls=0;const receipts=[];
 const result=await repairWithFeedback({
  build:async f=>{calls++;if(calls===2)throw Error('Unexpected token in JSON');if(calls===3){assert.deepEqual(f.failures.map(x=>x.stage),['review','build']);assert.match(f.failures[0].reason,/SQLite/)}return {attempt:calls}},
  review:async c=>({approved:c.attempt!==1,reason:'SQLite ADD COLUMN IF NOT EXISTS is invalid'}),
  test:async()=>({passed:true}),arbitrate:async()=>({decision:'approve'}),restore:async()=>{},onFeedback:async f=>receipts.push(f)
 });
 assert.equal(result.attempt,3);assert.equal(receipts[0].failures.length,1,'older receipts must not mutate');
});
test('retry hands the previous authenticated failure to the engineer',async()=>{
 const initialFeedback={stage:'test',reason:'describe is not defined'};
 const result=await repairWithFeedback({initialFeedback,build:async previous=>{assert.deepEqual(previous,initialFeedback);return {};},review:async()=>({approved:true}),test:async()=>({passed:true}),arbitrate:async()=>({decision:'approve'}),restore:async()=>{assert.fail('unexpected restore')},onFeedback:async()=>{assert.fail('unexpected failure')}});
 assert.equal(result.attempt,1);
});
test('review rejection and failed tests return to engineer; only tested approved patch can finish',async()=>{
 let builds=0,restores=0,checks=0,arbitrations=0;const feedback=[];
 const result=await repairWithFeedback({
  build:async previous=>{builds++;if(builds>1)assert.equal(previous.reason,builds===2?'CommonJS imports invalid':'test failed');return {version:builds};},
  review:async c=>({approved:c.version!==1,reason:'CommonJS imports invalid'}),
  test:async()=>{checks++;if(checks===1)throw Error('test failed');return {passed:true,output:'real test result'};},
  arbitrate:async(c,review,tests)=>{arbitrations++;assert.equal(c.version,3);assert.equal(review.approved,true);assert.equal(tests.output,'real test result');return {decision:'approve'};},
  restore:async()=>{restores++;},onFeedback:async f=>feedback.push(f)
 });
 assert.equal(result.attempt,3);assert.equal(restores,2);assert.equal(arbitrations,1);assert.deepEqual(feedback.map(f=>f.stage),['review','test']);
});
test('Purple rejection cannot commit and repair retries stop at the bound',async()=>{
 let restored=0,builds=0;
 await assert.rejects(repairWithFeedback({build:async()=>{builds++;return {};},review:async()=>({approved:true}),test:async()=>({passed:true}),arbitrate:async()=>({decision:'reject',reason:'unmet owner requirement'}),restore:async()=>{restored++;},onFeedback:async()=>{}}),/attempts exhausted.*unmet owner requirement/);
 assert.equal(builds,3);assert.equal(restored,3);
});
