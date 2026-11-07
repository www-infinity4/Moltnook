import test from 'node:test';
import assert from 'node:assert/strict';
import {selectColorPreface, selectColorFollowups} from './color-task-routing.mjs';

const files=['coupon-quick-cards.mjs','test/coupon-quick-cards.test.mjs','data/verified-coupon-offers.json'];

test('a pinned, explicitly scoped repair goes directly to the existing Blue plan / Green build',()=>{
 const chosen=selectColorPreface({routing:{kind:'repair',targetPaths:['coupon-quick-cards.mjs']}},files);
 assert.deepEqual(chosen.firstRoles,[]);
 assert.equal(chosen.lane,'green-direct');
 assert.deepEqual(selectColorFollowups(chosen,null),[]);
});

test('an unverified target path does not enter the direct Green lane',()=>{
 const chosen=selectColorPreface({routing:{kind:'repair',targetPaths:['not-present.mjs']}},files);
 assert.deepEqual(chosen.firstRoles,['red']);
 assert.equal(chosen.lane,'investigate');
});

test('ordinary work starts with the full Red GPT reader and bypasses Orange when there is no decision to make',()=>{
 const chosen=selectColorPreface({instructions:'Repair this existing component'},files);
 assert.deepEqual(chosen.firstRoles,['red']);
 assert.deepEqual(selectColorFollowups(chosen,{status:'model_inference_completed',blockers:[]}),[]);
});

test('Red blockers or an explicit decision task send Orange to decide',()=>{
 const generic=selectColorPreface({},files);
 assert.deepEqual(selectColorFollowups(generic,{status:'model_inference_completed',blockers:['source contract unclear']}),['orange']);
 const explicit=selectColorPreface({routing:{kind:'decision'}},files);
 assert.deepEqual(selectColorFollowups(explicit,{status:'model_inference_completed',blockers:[]}),['orange']);
});

test('Blue is consulted for verified-path imports, but never treats GPT inference as actual importing',()=>{
 const chosen=selectColorPreface({routing:{kind:'import',targetPaths:['data/verified-coupon-offers.json']}},files);
 assert.deepEqual(chosen.firstRoles,['red']);
 assert.deepEqual(selectColorFollowups(chosen,{status:'model_inference_completed',blockers:[]}),['blue']);
 assert.equal(chosen.executionAuthorized,false);
});

test('missing or blocked import sources route to Orange instead of importing unsupported data',()=>{
 const chosen=selectColorPreface({routing:{kind:'import',targetPaths:['missing.json']}},files);
 assert.deepEqual(selectColorFollowups(chosen,{status:'model_inference_completed',blockers:[]}),['orange']);
});

test('missing Red inference never produces a fictitious intelligent decision',()=>{
 const chosen=selectColorPreface({},files);
 assert.deepEqual(selectColorFollowups(chosen,null),[]);
});

test('untrusted routing kinds and traversal do not trigger a direct engineering shortcut',()=>{
 for(const bad of [
  {routing:{kind:'repair',targetPaths:['../secrets.env']}},
  {routing:{kind:'deploy',targetPaths:['coupon-quick-cards.mjs']}},
  {routing:{kind:'repair',targetPaths:[]}}
 ]){
  assert.equal(selectColorPreface(bad,files).lane,'investigate');
 }
});
