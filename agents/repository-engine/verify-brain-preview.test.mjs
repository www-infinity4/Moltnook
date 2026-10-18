import test from 'node:test';
import assert from 'node:assert/strict';
import {singleDeployment,validatePreview} from './verify-brain-preview.mjs';
const deployId='8ec9e28e-badc-4a2f-8d48-4951e2e79931';
const stable='bb324bd0-d25f-4684-bd43-5abc1e06b667';
const payload={success:true,result:{deployments:[{
 id:deployId,versions:[{version_id:stable,percentage:100}]
}]}};
const clean={ok:true,mode:'isolated_preview_only',ticketCount:0,
 sourceDecisionVerified:true,ownerPriorityVerified:true,recoveryEligible:true,
 distinctClockReady:true,productionTrafficTouched:false,
 ownerOrWalletOperationsAllowed:false};

test('actual Cloudflare deployed singleton must remain an exact 100-percent stable version',()=>{
 assert.deepEqual(singleDeployment(payload),{id:deployId,versionId:stable,percentage:100});
 for(const change of [
  {success:false,result:payload.result},
  {success:true,result:{deployments:[]}},
  {success:true,result:{deployments:[{id:deployId,versions:[{version_id:stable,percentage:99}]}]}},
  {success:true,result:{deployments:[{id:deployId,versions:[
   {version_id:stable,percentage:90},
   {version_id:'86aee386-f083-428b-8f73-b606b46e7525',percentage:10}
  ]}]}}
 ])assert.throws(()=>singleDeployment(change),/unexpected_production_state/);
});
test('preview gate requires real synthetic admission, isolated DO and an empty dedicated D1',()=>{
 assert.deepEqual(validatePreview(clean),{isolationVerified:true,checked:8});
 for(const key of ['sourceDecisionVerified','ownerPriorityVerified','recoveryEligible','distinctClockReady']){
  assert.throws(()=>validatePreview({...clean,[key]:false}),new RegExp('isolated_preview_check_failed'));
 }
 for(const key of ['productionTrafficTouched','ownerOrWalletOperationsAllowed'])
  assert.throws(()=>validatePreview({...clean,[key]:true}),/isolated_preview_check_failed/);
 assert.throws(()=>validatePreview({...clean,ticketCount:1}),/isolated_preview_admission_failed/);
 assert.throws(()=>validatePreview({...clean,ok:false}),/isolated_preview_admission_failed/);
});
