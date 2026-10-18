import test from 'node:test';
import assert from 'node:assert/strict';
import {reuseDecision,expectedSlug} from './brain-preview-reuse.mjs';

const prodNs='1'.repeat(32),otherNs='09dc5074676c4113bf87b940ceb152c7',pid='b5ad542188964721a0ab59319c1f0b3a';
const deployment={
 id:'18b7245d-1d85-43e1-afd4-9c0f51bb0fb3',
 main_module:'brain-isolated-probe.js',
 annotations:{'workers/tag':'26518e9'},
 env:{BRAIN_CANARY_MODE:{text:'isolated',type:'plain_text'},
  CLOCK:{type:'durable_object_namespace',namespace_id:otherNs},
  WORK_DB:{type:'d1',database_id:'76deaa98-5d3a-4151-8390-e14d7da87cb3'}}
};
const preview={id:pid,slug:expectedSlug};
const decide=(changes={})=>reuseDecision({
 previews:changes.previews??[preview],
 deployments:changes.deployments??[deployment],
 productionNamespace:prodNs
});
test('reuse the exact existing pinned, isolated Cloudflare Preview without uploading',()=>{
 const result=decide();
 assert.equal(result.reuse,true);
 assert.equal(result.previewId,pid);
 assert.equal(result.deploymentId,deployment.id);
 assert.equal(result.reason,'verified_preview_already_exists');
});
test('if no Preview exists request a new isolated one, not a production version upload',()=>{
 assert.deepEqual(decide({previews:[],deployments:[]}),{
  reuse:false,reason:'preview_not_created'});
});
test('never reuse Preview with wallet, owner credential, model or production DO/D1',()=>{
 for(const name of ['BOT_WALLET','WRITER_OWNER_HASH','MODELS','BOT_WORK_SECRET']){
  const bad={...deployment,env:{...deployment.env,[name]:{type:'secret_text'}}};
  assert.throws(()=>decide({deployments:[bad]}),/preview_forbidden_runtime_binding/);
 }
 for(const changes of [
  {env:{...deployment.env,CLOCK:{type:'durable_object_namespace',namespace_id:prodNs}}},
  {env:{...deployment.env,WORK_DB:{type:'d1',database_id:'4aa6a463-02c6-48c3-854f-a87c0ca5f41c'}}},
  {env:{...deployment.env,BRAIN_CANARY_MODE:{type:'plain_text',text:'production'}}},
  {main_module:'worker.js'},
  {annotations:{'workers/tag':'different'}}
 ]){
  assert.throws(()=>decide({deployments:[{...deployment,...changes}]}));
 }
 assert.throws(()=>decide({previews:[preview,preview]}),/multiple_preview/);
 assert.throws(()=>decide({previews:[{id:pid,slug:'other'}]}),/unexpected_preview/);
});
test('latest Preview must have source pin and one immutable deployment',()=>{
 assert.throws(()=>decide({deployments:[]}),/preview_deployment_missing/);
 assert.throws(()=>decide({deployments:[{...deployment,id:'not-a-uuid'}]}),/preview_deployment_id_invalid/);
});
