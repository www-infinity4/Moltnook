import {test} from 'node:test';import assert from 'node:assert/strict';import {assessRollout} from './rollout-gate.mjs';
const evidence={candidate:{fixture:false,commitSha:'new',versionId:'candidate'},stable:{commitSha:'old',versionId:'stable'},checks:{sourceMatched:true,browserPassed:true,purpleApproved:true},samples:20,errors:0,migrationsReversible:true};
test('fixtures, missing gates and migration risks never reach users',()=>{
 for(const change of [{candidate:{...evidence.candidate,fixture:true}},{checks:{...evidence.checks,browserPassed:false}},{migrationsReversible:false},{stable:{}}])assert.equal(assessRollout({...evidence,...change}).action,'hold');
});
test('promotion is gradual and observed errors choose the known stable version',()=>{
 assert.equal(assessRollout(evidence).weight,.01);assert.equal(assessRollout({...evidence,weight:.01}).weight,.1);
 const r=assessRollout({...evidence,errors:1,weight:.1});assert.equal(r.action,'rollback');assert.equal(r.versionId,'stable');assert.equal(r.weight,0);
 assert.equal(assessRollout({...evidence,samples:1}).action,'observe');
});
