import test from 'node:test';
import assert from 'node:assert/strict';
import {
 validateCanary,requireOwnerApproval,requireBindingAndRuntimeParity,
 requireProductionState,requireProductionStateAfter,releaseDecision,
 STABLE_VERSION,CANDIDATE_VERSION,SOURCE_COMMIT,BASELINE_DEPLOYMENT
} from './brain-owner-release.mjs';
const now=Date.parse('2026-10-18T02:06:00Z');
const canary={
 status:'isolated_preview_verified',stage:'synthetic_read_only_canary',
 sourceSha:SOURCE_COMMIT,candidateVersionId:CANDIDATE_VERSION,
 productionDeploymentId:BASELINE_DEPLOYMENT,productionVersionId:STABLE_VERSION,
 prodBeforeAfterEqual:true,isolatedD1:true,isolatedDurableObject:true,
 originalTicketsCopied:false,ownerOrWalletWrites:false,liveProductionPromoted:false,
 isolationVerified:true,checked:8,when:new Date(now-1000).toISOString()
};
const bindings=[
 ['BOT_WALLET','service',{service:'unified-wallet',environment:'production'}],
 ['BOT_WORK_SECRET','secret_text',{}],
 ['CLOCK','durable_object_namespace',{class_name:'BrainClock',namespace_id:'stable-namespace'}],
 ['MODELS','service',{service:'infinity-rogers',environment:'production',entrypoint:'BrainModels'}],
 ['WORK_DB','d1',{database_id:'existing-d1'}],
 ['WRITER_AI','ai',{}],['WRITER_OWNER_HASH','plain_text',{text:'secret-owner-id-for-test'}]
].map(([name,type,properties])=>({name,type,...properties}));
const version=(list=bindings)=>({resources:{
 bindings:list,script_runtime:{migration_tag:'v1',compatibility_date:'2026-10-10'},
 script:{named_handlers:[{name:'BrainClock',handlers:['class']}]}
}});
const deployed=(versionId=STABLE_VERSION,id=BASELINE_DEPLOYMENT)=>({
 deployments:[{id,versions:[{version_id:versionId,percentage:100}]}]
});
const input={
 mode:'release',approval:'DEPLOY_BRAIN_100',actor:'www-infinity4',
 canary,stableVersion:version(),candidateVersion:version([...bindings].reverse()),
 deployments:deployed(),previewEnabled:false,now
};
test('a real fresh synthetic isolated canary plus exact bindings can propose one whole-version release',()=>{
 const r=releaseDecision(input);
 assert.equal(r.action,'release');
 assert.equal(r.productionWeight,100);
 assert.equal(r.partialCanaryForbidden,true);
 assert.equal(r.expectedDeploymentId,BASELINE_DEPLOYMENT);
 assert.equal(r.proposedVersionId,CANDIDATE_VERSION);
 assert.equal(r.parity.count,7);
 assert.ok(!JSON.stringify(r).includes('secret-owner-id-for-test'));
});
test('only explicit GitHub owner confirmation authorizes a release or rollback',()=>{
 for(const actor of ['dependabot[bot]','github-actions[bot]','outsider',''])
  assert.throws(()=>requireOwnerApproval({actor,mode:'release',approval:'DEPLOY_BRAIN_100'}),/owner_actor_required/);
 for(const approval of ['yes','*','DEPLOY_BRAIN_10','ROLLBACK_BRAIN_100',''])
  assert.throws(()=>requireOwnerApproval({actor:'www-infinity4',mode:'release',approval}),/explicit_owner_confirmation_required/);
 assert.equal(requireOwnerApproval({actor:'www-infinity4',mode:'rollback',approval:'ROLLBACK_BRAIN_100'}),true);
});
test('owner consent does not skip isolated preview receipts and canary age',()=>{
 for(const [key,value] of [
  ['sourceSha','wrong'],['candidateVersionId',STABLE_VERSION],
  ['prodBeforeAfterEqual',false],['isolatedD1',false],
  ['isolatedDurableObject',false],['ownerOrWalletWrites',true],
  ['originalTicketsCopied',true],['liveProductionPromoted',true],
  ['isolationVerified',false],['checked',7]
 ]){
  assert.throws(()=>validateCanary({...canary,[key]:value},{now}),/isolated_canary/);
 }
 assert.throws(()=>validateCanary({...canary,when:new Date(now-4*86400000).toISOString()},{now}),/expired/);
});
test('no service, owner, model, wallet or DO binding may change on promotion',()=>{
 for(const name of ['BOT_WALLET','BOT_WORK_SECRET','CLOCK','MODELS','WORK_DB','WRITER_AI','WRITER_OWNER_HASH']){
  const changed=bindings.map(b=>b.name===name?{...b,changed:'not-approved'}:b);
  assert.throws(()=>requireBindingAndRuntimeParity(version(),version(changed)),
   new RegExp('worker_binding_drift_'+name));
 }
 const extra=[...bindings,{name:'NEW_GLOBAL_SECRET',type:'secret_text'}];
 assert.throws(()=>requireBindingAndRuntimeParity(version(),version(extra)),/worker_binding_name_mismatch/);
});
test('no migration, new named handler or runtime compat date may sneak into singleton production',()=>{
 const runtime=version();
 runtime.resources.script_runtime.migration_tag='v2';
 assert.throws(()=>requireBindingAndRuntimeParity(version(),runtime),/migration_or_compatibility_drift/);
 const changed=version();
 changed.resources.script.named_handlers.push({name:'OwnerEscalation',handlers:['class']});
 assert.throws(()=>requireBindingAndRuntimeParity(version(),changed),/class_or_entrypoint_drift/);
});
test('no automatic partial rollout; fail closed on deployment changes or preview URLs',()=>{
 for(const versions of [
  [{version_id:CANDIDATE_VERSION,percentage:10},{version_id:STABLE_VERSION,percentage:90}],
  [{version_id:STABLE_VERSION,percentage:99}]
 ]){
  assert.throws(()=>requireProductionState({deployments:[{id:BASELINE_DEPLOYMENT,versions}]}),/production_split/);
 }
 assert.throws(()=>releaseDecision({...input,previewEnabled:true}),/preview_url_must_be_disabled/);
 assert.throws(()=>releaseDecision({...input,deployments:deployed(STABLE_VERSION,'00000000-0000-0000-0000-000000000000')}),/baseline_changed/);
 assert.throws(()=>releaseDecision({...input,deployments:deployed(CANDIDATE_VERSION)}),/baseline_changed/);
});
test('rollback only from the exact candidate to the recorded previous stable version',()=>{
 const rollback=releaseDecision({...input,mode:'rollback',approval:'ROLLBACK_BRAIN_100',
  canary:null,deployments:deployed(CANDIDATE_VERSION,'12345678-1234-1234-1234-123456789abc')});
 assert.equal(rollback.proposedVersionId,STABLE_VERSION);
 assert.equal(rollback.productionWeight,100);
 assert.throws(()=>releaseDecision({...input,mode:'rollback',approval:'ROLLBACK_BRAIN_100',
  deployments:deployed(STABLE_VERSION)}),/rollback_refuses_unrelated_active_version/);
});
test('post-deployment acknowledgement must include exact expected deployment/version and 100 percent',()=>{
 const id='12345678-1234-1234-1234-123456789abc';
 assert.equal(requireProductionStateAfter(deployed(CANDIDATE_VERSION,id),CANDIDATE_VERSION,id).versionId,CANDIDATE_VERSION);
 assert.throws(()=>requireProductionStateAfter(deployed(CANDIDATE_VERSION,id),STABLE_VERSION,id),/release_readback/);
 assert.throws(()=>requireProductionStateAfter(deployed(CANDIDATE_VERSION,id),CANDIDATE_VERSION,BASELINE_DEPLOYMENT),/release_readback/);
});
