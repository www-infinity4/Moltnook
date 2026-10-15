import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCandidate,TARGETS,runAutoPromotion} from './auto-promote-reviewed.mjs';
const sha='a'.repeat(40);
function candidate(){
 return {state:'open',draft:false,mergeable:true,mergeable_state:'clean',
  title:'Robot review: TASK-1',user:{login:'www-infinity4'},
  base:{ref:'main',repo:{name:'QuantaPhi',full_name:'www-infinity4/QuantaPhi'}},
  head:{ref:'robot/TASK-1/388200123',sha,repo:{full_name:'www-infinity4/QuantaPhi'}},
  body:'Staged source commit: '+sha+'\nindependent Pink review\nGPT Purple arbitration'
 };
}
const files=[{status:'modified',filename:'phone/phone.js'}];
const checks=[{status:'completed',conclusion:'success'}];
test('only pinned owner-created bot changes with completed target checks qualify',()=>{
 assert.equal(reviewCandidate(candidate(),files,checks,[]).ready,true);
 const tampered=candidate();tampered.head.sha='b'.repeat(40);
 assert.equal(reviewCandidate(tampered,files,checks,[]).ready,false);
 assert.equal(reviewCandidate({...candidate(),user:{login:'stranger'}},files,checks,[]).ready,false);
 assert.equal(reviewCandidate(candidate(),[{status:'modified',filename:'.github/workflows/evil.yml'}],checks,[]).ready,false);
 assert.equal(reviewCandidate(candidate(),[{status:'added',filename:'workers/infinity-brain-clock/worker.js'}],checks,[]).ready,false);
 assert.equal(reviewCandidate(candidate(),files,[{status:'in_progress',conclusion:null}],[]).ready,false);
 assert.equal(reviewCandidate(candidate(),files,[],[]).ready,false);
 assert.equal(reviewCandidate(candidate(),files,checks,[{state:'pending'}]).ready,false);
 assert.equal(reviewCandidate({...candidate(),mergeable_state:'behind'},files,checks,[]).ready,false);
 assert.equal(reviewCandidate({...candidate(),base:{ref:'main',repo:{name:'Other',full_name:'other/Other'}}},files,checks,[]).ready,false);
});
test('no token means zero merges and no simulated result',async()=>{
 const report=await runAutoPromotion({token:''});
 assert.equal(report.mode,'blocked_missing_writer_credential');
 assert.equal(report.merged.length,0);
 assert.ok(TARGETS.includes('QuantaPhi'));
});
