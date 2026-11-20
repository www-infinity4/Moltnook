import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBindingDigests,live100Percent,compareStaged,REQUIRED_BINDINGS} from './brain-cloudflare-stage.mjs';
import * as stage from './brain-cloudflare-stage.mjs';
const id1='bb324bd0-d25f-4684-bd43-5abc1e06b667',id2='facda43e-23ea-4476-a12b-bbdee07e69cd';
const deployId='8ec9e28e-badc-4a2f-8d48-4951e2e79931';
const commit='a'.repeat(40);
const candidateVersion=(bindings,versionId=id2)=>({
 id:versionId,annotations:{'workers/message':'Verified Brain source from '+commit},
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
test('owner-created Cloudflare token manager survives staging as an opaque exact binding',()=>{
 const ownerTokenBinding={name:'Cloudflare_token_manager',type:'secret_text',
  secret_id:'opaque-account-managed-token-value'};
 const before={active:deployed,bindings:safeBindingDigests({
  resources:{bindings:[...resources,ownerTokenBinding]}})};
 assert.equal(before.bindings.Cloudflare_token_manager.type,'secret_text');
 const good=compareStaged({before,activeAfter:{...deployed},
  candidate:candidateVersion([ownerTokenBinding,...resources]),
  expectedCommit:commit,candidateId:id2});
 assert.equal(good.bindingIdentitiesVerified,true);
 assert.ok(good.bindingNames.includes('Cloudflare_token_manager'));
 assert.ok(!JSON.stringify(good).includes('opaque-account-managed-token-value'));
 assert.throws(()=>compareStaged({before,activeAfter:deployed,
  candidate:candidateVersion(resources),expectedCommit:commit,candidateId:id2}),
  /candidate_binding_list_changed/,'accidental loss of existing token-manager secret must block rollout');
 assert.throws(()=>compareStaged({before,activeAfter:deployed,
  candidate:candidateVersion([...resources,{...ownerTokenBinding,secret_id:'changed'}]),
  expectedCommit:commit,candidateId:id2}),
  /candidate_binding_identity_changed: Cloudflare_token_manager/);
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

test('stage records the exact upload ID rather than the first item in a stale version listing',async()=>{
 const output='Uploaded infinity-brain-clock (1.31 sec)\nWorker Version ID: '+id2+'\n';
 const versionId=stage.parseUploadedVersion(output),reads=[];
 const candidate=await stage.readUploadedCandidate({versionId,readVersion:async route=>{
  reads.push(route);
  // A list may still show an older source. The immutable upload ID is authoritative.
  return route.startsWith('/versions?')?{items:[{id:id1}]}:candidateVersion(resources);
 }});
 assert.equal(versionId,id2);
 assert.deepEqual(reads,['/versions/'+id2]);
 assert.equal(compareStaged({before:baseline(),activeAfter:deployed,candidate,
  expectedCommit:commit,candidateId:versionId}).bindingIdentitiesVerified,true);
});

test('missing, ambiguous and malformed upload IDs fail closed instead of selecting another version',async()=>{
 for(const output of ['', 'Worker Version ID: invalid',
  'Worker Version ID: '+id1+'\nWorker Version ID: '+id2,
  'Worker Version ID: '+id2+'\nWorker Version ID: '+id2,
  'Diagnostic message: Worker Version ID: '+id2])
  assert.throws(()=>stage.parseUploadedVersion(output),/upload_version_id_unverified/);
 for(const versionId of [undefined,'',id2+'/content','invalid'])
  await assert.rejects(stage.readUploadedCandidate({versionId,
   readVersion:async()=>assert.fail('invalid ID must not reach the API')}),/candidate_version_invalid/);
});

test('upload ID accepts terminal formatting but a mismatched immutable readback is rejected',async()=>{
 assert.equal(stage.parseUploadedVersion('\u001b[32mWorker Version ID: '+id2+'\u001b[0m\r\n'),id2);
 await assert.rejects(stage.readUploadedCandidate({versionId:id2,
  readVersion:async()=>candidateVersion(resources,id1)}),/candidate_version_readback_mismatch/);
});
