import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './oracle-review-promoter.mjs';

const trusted={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'www-infinity4/Moltnook',GITHUB_REF:'refs/heads/main',REPOSITORY_WRITE_TOKEN:'fixture-not-a-real-token'};

test('Oracle promoter delegates routine merges to shared exact-head CI gate without model approval',async()=>{
 let options,receipt;
 const result=await run({
  environment:trusted,
  promote:async input=>{options=input;return {configured:true,scanned:1,merged:[{repository:'Moltnook',pr:123,mergeSha:'a'.repeat(40)}],deferred:[]};},
  writeReceipt:async value=>{receipt=value;}
 });
 assert.deepEqual(options,{token:'fixture-not-a-real-token',maxMerges:4});
 assert.equal(result.modelReviewRequired,false);
 assert.equal(result.policy,'target-ci-owner-scoped-github-merge');
 assert.equal(result.merged.length,1);
 assert.equal(receipt.modelReviewRequired,false);
});

test('Oracle promoter refuses to run on PR or an untrusted ref',async()=>{
 let called=false;
 await assert.rejects(run({
  environment:{...trusted,GITHUB_REF:'refs/pull/123/merge'},
  promote:async()=>{called=true;return {};},
  writeReceipt:async()=>{}
 }),/trusted Moltnook main/);
 assert.equal(called,false);
});

test('Oracle promoter does not promote without the existing scoped writer credential',async()=>{
 let called=false;
 const result=await run({
  environment:{...trusted,REPOSITORY_WRITE_TOKEN:''},
  promote:async()=>{called=true;throw Error('must not call');},
  writeReceipt:async()=>{}
 });
 assert.equal(result.configured,false);
 assert.equal(result.mode,'blocked_missing_writer_credential');
 assert.equal(called,false);
});
