import test from 'node:test';
import assert from 'node:assert/strict';
import {publishReviewed} from './publish-reviewed.mjs';
const input={repository:'www-infinity4/QuantaPhi',base:'main',commitSha:'a'.repeat(40),jobId:'ticket/TASK-1',runId:'123'};
test('every bot commit is staged on a task branch with a real PR receipt',async()=>{
 const pushes=[];
 const r=await publishReviewed({...input,push:async ref=>{pushes.push(ref)},api:async(path,request)=>{
  assert.equal(path,'repos/www-infinity4/QuantaPhi/pulls');
  assert.equal(request.body.base,'main');
  assert.equal(request.body.head,'robot/ticket-TASK-1/123');
  assert.match(request.body.body,/target-repository CI/);
  return {html_url:'https://github.com/www-infinity4/QuantaPhi/pull/1',number:1,head:{sha:input.commitSha},base:{ref:'main'}};
 }});
 assert.deepEqual(pushes,['HEAD:refs/heads/robot/ticket-TASK-1/123']);
 assert.equal(r.publishedToDefault,false);
 assert.equal(r.reviewState,'awaiting_target_ci_and_merge_review');
 assert.equal(r.status,'committed_unverified');
});
test('missing PR receipt is a hard error, never a completed publication',async()=>{
 await assert.rejects(publishReviewed({...input,push:async()=>{},api:async()=>({number:1,head:{sha:'b'.repeat(40)}})}),/reviewed_pr_receipt_mismatch/);
});
test('network and permission failures never fall back to pushing main',async()=>{
 const pushes=[];
 await assert.rejects(publishReviewed({...input,push:async ref=>{pushes.push(ref);throw Error('credential denied')},api:async()=>{throw Error('must not call')}}),/credential denied/);
 assert.equal(pushes.length,1);
 assert.ok(!pushes[0].includes('HEAD:main'));
});
