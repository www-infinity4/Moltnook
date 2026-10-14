import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleFiles,verifyRobotPR,parseModelVerdict} from './oracle-review-gate.mjs';
const sha='a'.repeat(40);
const pr={state:'open',draft:false,mergeable:true,title:'Robot review: OR-12',body:'Staged source commit: '+sha,
 base:{ref:'main',repo:{full_name:'www-infinity4/QuantaPhi'}},head:{sha,ref:'robot/OR-12/123',repo:{full_name:'www-infinity4/QuantaPhi'}}};
const files=[{filename:'oracle-card.css',status:'modified',changes:24}];
const checks=[{name:'Test Oracle components',app:{slug:'github-actions'},status:'completed',conclusion:'success'}];
test('independent target-repo test and exact SHA are mandatory',()=>{
 assert.equal(verifyRobotPR(pr,files,checks,{state:'success'}).ok,true);
 assert.equal(verifyRobotPR(pr,files,[],{state:'success'}).ok,false);
 assert.equal(verifyRobotPR({...pr,body:'trust me'},files,checks,{}).ok,false);
 assert.equal(verifyRobotPR(pr,files,[{...checks[0],status:'in_progress'}],{}).ok,false);
 assert.equal(verifyRobotPR({...pr,head:{...pr.head,ref:'some-other'}},files,checks,{}).ok,false);
});
test('high risk work cannot auto merge even with a passing model review',()=>{
 for(const filename of ['workers/wallet.js','.github/workflows/test.yml','phi-script.js','auth.css','../secrets','README.md']){
  assert.equal(eligibleFiles([{filename,status:'modified',changes:2}]).ok,false,filename);
 }
 assert.equal(eligibleFiles(files).ok,true);
});
test('GPT response must explicitly approve the exact immutable commit',()=>{
 const payload=JSON.stringify({decision:'approve',sha,reason:'Oracle typography improves mobile readability without changing behavior.'});
 assert.equal(parseModelVerdict(payload,sha).decision,'approve');
 assert.throws(()=>parseModelVerdict(payload,'b'.repeat(40)));
 assert.throws(()=>parseModelVerdict('{"decision":"approve"}',sha));
});
