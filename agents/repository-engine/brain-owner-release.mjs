/*
 * Owner-initiated, fail-closed Robot Brain whole-version release.
 * The BrainClock Durable Object is a singleton: never use percent rollout.
 * This code NEVER retrieves or prints any secret or owner-hash value.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SHA=/^[0-9a-f]{40}$/;
const SCRIPT='infinity-brain-clock';
const ACCOUNT='ef25728c096c6ba92cf510caa2058003';
const RECEIPT='repository-receipts/brain-owner-release.json';
export const STABLE_VERSION='10a32f52-bdd2-42c4-a25a-3650233bcda7';
export const CANDIDATE_VERSION='012107be-79c6-400e-b279-69d11cd646d5';
export const SOURCE_COMMIT='ca40684a16fa977f3a3576b62e30c269099c3e51';
export const BASELINE_DEPLOYMENT='f5af22f6-d792-4ce5-b6b0-7e2e07ec1d2c';
const REQUIRED=['BOT_WALLET','BOT_WORK_SECRET','CLOCK','MODELS','WORK_DB','WRITER_AI','WRITER_OWNER_HASH'];
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
function digest(x){return createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');}
export function validateCanary(receipt,{now=Date.now()}={}){
 if(!receipt||receipt.status!=='isolated_preview_verified'||receipt.stage!=='synthetic_read_only_canary'||
  receipt.sourceSha!==SOURCE_COMMIT||receipt.candidateVersionId!==CANDIDATE_VERSION||
  receipt.productionDeploymentId!==BASELINE_DEPLOYMENT||receipt.productionVersionId!==STABLE_VERSION||
  receipt.prodBeforeAfterEqual!==true||receipt.isolatedD1!==true||
  receipt.isolatedDurableObject!==true||receipt.originalTicketsCopied!==false||
  receipt.ownerOrWalletWrites!==false||receipt.liveProductionPromoted!==false||
  receipt.isolationVerified!==true||!(Number(receipt.checked)>=8))
  throw Error('isolated_canary_evidence_incomplete_or_mismatched');
 const when=Date.parse(receipt.when);
 if(!Number.isFinite(when)||when>now+60000||now-when>72*3600000)
  throw Error('isolated_canary_evidence_expired');
 return {status:'isolated_canary_verified',sourceSha:receipt.sourceSha,checked:receipt.checked};
}
export function requireOwnerApproval({actor,mode,approval}){
 if(actor!=='www-infinity4')throw Error('owner_actor_required');
 if(!['release','rollback'].includes(mode))throw Error('release_mode_invalid');
 if(approval!==(mode==='release'?'DEPLOY_BRAIN_100':'ROLLBACK_BRAIN_100'))
  throw Error('explicit_owner_confirmation_required');
 return true;
}
export function requireBindingAndRuntimeParity(stableVersion,candidateVersion){
 const old=stableVersion?.resources?.bindings,newList=candidateVersion?.resources?.bindings;
 if(!Array.isArray(old)||!Array.isArray(newList))throw Error('version_binding_receipts_unavailable');
 const left=Object.fromEntries(old.map(b=>[b.name,b]));
 const right=Object.fromEntries(newList.map(b=>[b.name,b]));
 if(Object.keys(left).length!==old.length||Object.keys(right).length!==newList.length)
  throw Error('duplicate_worker_binding_detected');
 if(JSON.stringify(Object.keys(left).sort())!==JSON.stringify(Object.keys(right).sort()))
  throw Error('worker_binding_name_mismatch');
 for(const name of REQUIRED){
  if(!left[name]||!right[name]||digest(left[name])!==digest(right[name]))
   throw Error('worker_binding_drift_'+name);
 }
 for(const name of Object.keys(left))
  if(digest(left[name])!==digest(right[name]))throw Error('worker_binding_drift_'+name);
 const a=stableVersion?.resources?.script_runtime,b=candidateVersion?.resources?.script_runtime;
 if(a?.migration_tag!=='v1'||b?.migration_tag!==a?.migration_tag||
  b?.compatibility_date!==a?.compatibility_date)
  throw Error('durable_object_migration_or_compatibility_drift');
 const canonical=x=>JSON.stringify((x?.resources?.script?.named_handlers||[]).map(h=>[h.name,[...h.handlers].sort()]).sort());
 if(canonical(stableVersion)!==canonical(candidateVersion))
  throw Error('worker_class_or_entrypoint_drift');
 return {count:old.length,runtime:a.compatibility_date,migrationTag:a.migration_tag};
}
export function requireProductionState(deployments,{mode='release'}={}){
 const current=(deployments?.deployments||deployments||[])[0];
 if(!UUID.test(current?.id||'')||current.versions?.length!==1||
  current.versions[0].percentage!==100)throw Error('production_split_or_receipt_unverified');
 const live=current.versions[0].version_id;
 if(mode==='release'&&(current.id!==BASELINE_DEPLOYMENT||live!==STABLE_VERSION))
  throw Error('production_baseline_changed_since_canary');
 if(mode==='rollback'&&live!==CANDIDATE_VERSION)
  throw Error('rollback_refuses_unrelated_active_version');
 return {deploymentId:current.id,versionId:live};
}
export function releaseDecision({mode,approval,actor,canary,stableVersion,candidateVersion,deployments,previewEnabled=false,now=Date.now()}){
 requireOwnerApproval({actor,mode,approval});
 const prod=requireProductionState(deployments,{mode});
 if(previewEnabled!==false)throw Error('public_preview_url_must_be_disabled');
 const parity=requireBindingAndRuntimeParity(stableVersion,candidateVersion);
 if(mode==='release')validateCanary(canary,{now});
 const next=mode==='release'?CANDIDATE_VERSION:STABLE_VERSION;
 return {action:mode,previousVersionId:prod.versionId,proposedVersionId:next,
  expectedDeploymentId:prod.deploymentId,parity,productionWeight:100,
  partialCanaryForbidden:true,ownerApproved:true};
}
async function perform(mode,approval,request=fetch){
 const token=process.env.CLOUDFLARE_API_TOKEN;
 if(!token)throw Error('cloudflare_token_missing_in_moltnook');
 const actor=process.env.GITHUB_ACTOR||'';
 requireOwnerApproval({actor,mode,approval});
 const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts/'+SCRIPT;
 const call=async(path,method='GET',body)=>{
  const r=await request(root+path,{
   method,headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),
   redirect:'error'
  });
  if(!r.ok)throw Error('cloudflare_api_'+method+'_failed_'+r.status);
  const json=await r.json();
  if(json.success!==true)throw Error('cloudflare_api_'+method+'_not_verified');
  return json.result;
 };
 const [dep,stableV,candidateV,subdomain]=await Promise.all([
  call('/deployments'),call('/versions/'+STABLE_VERSION),
  call('/versions/'+CANDIDATE_VERSION),call('/subdomain')
 ]);
 const canary=mode==='release'?JSON.parse(readFileSync('canary-proof/brain-isolated-preview-receipt.json','utf8')):null;
 const plan=releaseDecision({mode,approval,actor,canary,stableVersion:stableV,candidateVersion:candidateV,
  deployments:dep,previewEnabled:subdomain?.previews_enabled});
 mkdirSync('repository-receipts',{recursive:true});
 let mutationStarted=false;
 const writeReceipt=(receipt)=>writeFileSync(RECEIPT,JSON.stringify(receipt,null,2)+'\n');
 writeReceipt({...plan,status:'preflight_verified',mutated:false});
 const post=async(versionId,msg)=>call('/deployments','POST',{
  strategy:'percentage',versions:[{version_id:versionId,percentage:100}],
  annotations:{'workers/message':msg}
 });
 try{
  const latest=await call('/deployments');
  const expected=(latest?.deployments||latest||[])[0]?.id;
  if(expected!==plan.expectedDeploymentId)throw Error('deployment_raced_after_preflight');
  mutationStarted=true;
  const deployment=await post(plan.proposedVersionId,
   'Owner-verified '+mode+' from Moltnook commit '+(process.env.GITHUB_SHA||'unknown'));
  const after=await call('/deployments');
  const live=requireProductionStateAfter(after,plan.proposedVersionId,deployment?.id);
  writeReceipt({...plan,status:'deployed_readback_verified',deployedVersionId:live.versionId,
   deploymentId:live.deploymentId,mutated:true,rollbackVersionId:STABLE_VERSION,
   signedRunnerEndToEndVerified:false,ownerJobFinished:false,when:new Date().toISOString()});
  return {mode,status:'deployed_readback_verified',deploymentId:live.deploymentId};
 }catch(error){
  if(mutationStarted&&mode==='release'){
   try{
    const r=await post(STABLE_VERSION,'Automatic stable rollback after unverified owner Brain promotion');
    const d=requireProductionStateAfter(await call('/deployments'),STABLE_VERSION,r?.id);
    writeReceipt({...plan,status:'automatic_rollback_verified',deploymentId:d.deploymentId,
     stableVersionId:STABLE_VERSION,productionRestored:true,reason:String(error.message).slice(0,200)});
   }catch(rollbackError){
    writeReceipt({...plan,status:'manual_incident_investigation_required',
      reason:String(error.message).slice(0,200),rollbackError:String(rollbackError.message).slice(0,200)});
   }
  }else writeReceipt({...plan,status:'release_aborted_without_mutation',reason:String(error.message).slice(0,200)});
  throw error;
 }
}
export function requireProductionStateAfter(raw,expectedVersion,expectedId){
 const deployed=(raw?.deployments||raw||[])[0];
 if(!UUID.test(expectedId||'')||deployed?.id!==expectedId||deployed.versions?.length!==1||
  deployed.versions[0].version_id!==expectedVersion||deployed.versions[0].percentage!==100)
  throw Error('release_readback_version_mismatch');
 return {deploymentId:deployed.id,versionId:expectedVersion};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 perform(process.argv[2],process.env.OWNER_RELEASE_CONFIRMATION||'')
  .then(x=>console.log('Cloudflare '+x.mode+' '+x.status+' with exact 100% readback, signed owner job remains separate'))
  .catch(e=>{console.error(String(e.message||e));process.exitCode=1});
}
