import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBindingDigests,live100Percent,compareStaged,REQUIRED_BINDINGS} from './brain-cloudflare-stage.mjs';
const id1='bb324bd0-d25f-4684-bd43-5abc1e06b667',id2='facda43e-23ea-4476-a12b-bbdee07e69cd';
const deployId='8ec9e28e-badc-4a2f-8d48-4951e2e79931';
const commit='a'.repeat(40);
const candidateVersion=(bindings,versionId=id2)=>({
 id:versionId,annotations:{'workers/message':'Verified deferred recovery from '+commit},
 resources:{bindings}
});
const resources=Object.entries(REQUIRED_BINDINGS).map(([name,type])=>({
 name,type,...(name==='WORK_DB'?{id:'test-d1-id'}:{}),
 ...(name==='WRITER_OWNER_HASH'?{text:'test-private-owner-hash'}:{}),
 ...(name==='BOT_WORK_SECRET'?{secret_id:'unreadable-secret-marker'}:{})
}));
const deployed={id:deployId,versionId:id1};
function baseline(){
 return {active:deployed,bindings:safeBindingDigests({resources:{bindings:resources}})};
}
test('authenticated central bot staging requires exact Worker types including Durable Object, not KV',()=>{
 const digest=safeBindingDigests({resources:{bindings:resources}});
 assert.equal(digest.CLOCK.type,'durable_object_namespace');
 assert.equal(digest.WORK_DB.type,'d1');
 assert.equal(digest.BOT_WORK_SECRET.type,'secret_text');
 assert.equal(digest.WRITER_OWNER_HASH.type,'plain_text');
 assert.equal(Object.keys(digest).length,7);
 assert.ok(Object.values(digest).every(v=>/^[a-f0-9]{64}$/.test(v.sha256)));
 assert.ok(!JSON.stringify(digest).includes('test-private-owner-hash'),'never serialize plaintext owner identifier into receipts');
});
test('one existing production version at exactly 100% is required',()=>{
 assert.deepEqual(live100Percent({deployments:[{id:deployId,versions:[{version_id:id1,percentage:100}]}]}),deployed);
 assert.throws(()=>live100Percent({deployments:[{id:deployId,versions:[
  {version_id:id1,percentage:90},{version_id:id2,percentage:10}]}]}),/existing_100_percent/);
 assert.throws(()=>live100Percent({deployments:[]}),/existing_100_percent/);
});
test('fresh version can be staged only with matching exact identities and unchanged deployed version',()=>{
 const before=baseline();
 const candidate=candidateVersion([...resources].reverse());
 const result=compareStaged({before,activeAfter:{...deployed},candidate,expectedCommit:commit,candidateId:id2});
 assert.equal(result.status,'staged_zero_traffic');
 assert.equal(result.productionTrafficUnchanged,true);
 assert.equal(result.canaryPromoted,false);
 assert.equal(result.bindingIdentitiesVerified,true);
 assert.equal(result.targetGitSha,commit);
 assert.ok(!JSON.stringify(result).includes('test-private-owner-hash'));
});
test('owner id, secret binding or D1 target changes fail closed without a deployment',()=>{
 const before=baseline();
 for(const name of ['WORK_DB','WRITER_OWNER_HASH','BOT_WORK_SECRET','CLOCK','BOT_WALLET']){
  const changed=resources.map(x=>x.name===name?{...x,redirection:'forbidden'}:x);
  assert.throws(()=>compareStaged({before,activeAfter:deployed,candidate:candidateVersion(changed),
   expectedCommit:commit,candidateId:id2}),new RegExp('candidate_binding_identity_changed: '+name));
 }
 assert.throws(()=>safeBindingDigests({resources:{bindings:resources.filter(x=>x.name!=='BOT_WORK_SECRET')}}),
   /required_binding_missing_or_changed/);
});
test('preflight rejects version substitution, source mismatches and production traffic drift',()=>{
 const before=baseline(),good=candidateVersion(resources);
 assert.throws(()=>compareStaged({before,activeAfter:{...deployed,versionId:id2},candidate:good,
  expectedCommit:commit,candidateId:id2}),/production_traffic_changed/);
 assert.throws(()=>compareStaged({before,activeAfter:deployed,candidate:good,
  expectedCommit:'b'.repeat(40),candidateId:id2}),/candidate_source_provenance/);
 assert.throws(()=>compareStaged({before,activeAfter:deployed,candidate:good,
  expectedCommit:commit,candidateId:id1}),/no_new_immutable_candidate/);
 assert.throws(()=>compareStaged({before,activeAfter:deployed,candidate:good,
  expectedCommit:commit,candidateId:'foo'}),/no_new_immutable_candidate/);
});
