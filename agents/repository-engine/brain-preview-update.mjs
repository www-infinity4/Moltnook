/*
 * Replace code in an isolated Preview only (never POST a live deployment).
 * PATCH /previews/{id}/deployments/latest inherits its environment; we send
 * modules and evidence metadata only, never credentials or binding overrides.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const PRODUCTION_DEPLOYMENT='c426aa64-77a2-409c-9332-316225557c4c';
export const PRODUCTION_VERSION='b43fbe8f-4d3c-4943-a62e-f19627cec378';
export const CANDIDATE_VERSION='4af258f9-deaf-4612-a2ed-125fcac6685a';
export const SOURCE_SHA='715b0ef0688bc697546d1317cfe6d81360456f2d';
export const PREVIEW_SLUG='brain-candidate-26518e96';
export const PREVIEW_ID='b5ad542188964721a0ab59319c1f0b3a';
const ACCOUNT='ef25728c096c6ba92cf510caa2058003';
const WORKER='infinity-brain-clock';
const PREVIEW_DB='76deaa98-5d3a-4151-8390-e14d7da87cb3';
const PROD_DB='4aa6a463-02c6-48c3-854f-a87c0ca5f41c';
const DO=/^[0-9a-f]{32}$/;
const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const candidateName='brain-isolated-probe.js';

export function checkPreviewPatchPreflight({production,productionVersion,stagedVersion,
 previews,deployments,subdomain}){
 const current=(production?.deployments||production||[])[0];
 if(current?.id!==PRODUCTION_DEPLOYMENT||current?.versions?.length!==1||
   current.versions[0]?.version_id!==PRODUCTION_VERSION||
   current.versions[0]?.percentage!==100)
  throw Error('isolated_preview_production_baseline_changed');
 if(subdomain?.enabled!==true||subdomain?.previews_enabled!==false)
  throw Error('preview_routing_must_remain_disabled');
 const prodBindings=productionVersion?.resources?.bindings||[];
 const candidateBindings=stagedVersion?.resources?.bindings||[];
 if(!Array.isArray(prodBindings)||!Array.isArray(candidateBindings)||
    prodBindings.length!==candidateBindings.length||
    prodBindings.some(a=>JSON.stringify(a)!==
      JSON.stringify(candidateBindings.find(b=>b.name===a.name))))
  throw Error('staged_worker_binding_parity_failed');
 if(stagedVersion?.id!==CANDIDATE_VERSION||
    !String(stagedVersion.annotations?.['workers/message']||'').includes(SOURCE_SHA))
  throw Error('staged_source_commit_unverified');
 const runtime=stagedVersion?.resources?.script_runtime;
 if(runtime?.compatibility_date!=='2026-10-10'||
   JSON.stringify([...(runtime?.compatibility_flags||[])].sort())!==JSON.stringify(['global_fetch_strictly_public']))
  throw Error('staged_consent_routing_runtime_unverified');
 const productionClock=prodBindings.find(b=>b.name==='CLOCK');
 const productionD1=prodBindings.find(b=>b.name==='WORK_DB');
 if(!DO.test(productionClock?.namespace_id||'')||productionD1?.database_id!==PROD_DB)
  throw Error('production_resource_identity_unverified');
 const items=previews?.items||previews;
 if(!Array.isArray(items)||items.length!==1||items[0]?.id!==PREVIEW_ID||
    items[0]?.slug!==PREVIEW_SLUG)
  throw Error('unexpected_isolated_preview_inventory');
 const list=deployments?.items||deployments;
 const latest=Array.isArray(list)?list[0]:null,env=latest?.env||{};
 if(!latest||latest.main_module!==candidateName||
   !['bbf3a91','19510f5','ca40684','92c0e39','0206dba',SOURCE_SHA.slice(0,7)].includes(latest.annotations?.['workers/tag'])||
   JSON.stringify(Object.keys(env).sort())!==
     JSON.stringify(['BRAIN_CANARY_MODE','CLOCK','WORK_DB'])||
   env.BRAIN_CANARY_MODE?.text!=='isolated'||
   env.BRAIN_CANARY_MODE?.type!=='plain_text'||
   env.WORK_DB?.type!=='d1'||env.WORK_DB?.database_id!==PREVIEW_DB||
   env.CLOCK?.type!=='durable_object_namespace'||
   !DO.test(env.CLOCK?.namespace_id||'')||
   env.CLOCK?.namespace_id===productionClock.namespace_id)
  throw Error('isolated_preview_binding_or_module_unverified');
 return {previewId:PREVIEW_ID,previousDeploymentId:latest.id,
  existingTag:latest.annotations['workers/tag'],
  expectedProductionId:PRODUCTION_DEPLOYMENT,isolatedD1:PREVIEW_DB,
  isolatedClock:env.CLOCK.namespace_id};
}
export function buildPatch({js,sourceSha=SOURCE_SHA}){
 if(sourceSha!==SOURCE_SHA||typeof js!=='string'||js.length<500||
   Buffer.byteLength(js)>3_000_000||
   !js.includes('__preview__/admission')||
   !js.includes('ownerBlockPreserved')||!js.includes('mergedSourceRecognized')||
   !js.includes('source_review_only'))
  throw Error('bundled_synthetic_pink_probe_missing_or_invalid');
 return {compatibility_date:'2026-10-10',compatibility_flags:['global_fetch_strictly_public'],modules:[{name:candidateName,content_type:'application/javascript+module',
   content_base64:Buffer.from(js,'utf8').toString('base64')}],
  annotations:{'workers/commit_sha':SOURCE_SHA,
   'workers/tag':SOURCE_SHA.slice(0,7),
   'workers/message':'Isolated Pink source review Preview from staged QuantaPhi '+SOURCE_SHA}};
}
export function assertUpdatedPreview({before,after,productionBefore,productionAfter}){
 if(JSON.stringify(productionBefore)!==JSON.stringify(productionAfter))
  throw Error('production_changed_during_preview_update');
 const last=(after?.items||after||[])[0];
 if(!last||last.annotations?.['workers/tag']!==SOURCE_SHA.slice(0,7)||
   last.annotations?.['workers/commit_sha']!==SOURCE_SHA)
  throw Error('isolated_preview_update_source_missing');
 if(last.compatibility_date!=='2026-10-10'||
    JSON.stringify([...(last.compatibility_flags||[])].sort())!==JSON.stringify(['global_fetch_strictly_public']))
  throw Error('isolated_preview_runtime_flags_unverified');
 const prev=(before?.items||before||[])[0];
 if(prev?.id===last.id&&!(
   prev.annotations?.['workers/tag']===SOURCE_SHA.slice(0,7)))
  throw Error('isolated_preview_deployment_not_updated');
 const a=prev?.env||{},b=last.env||{};
 if(JSON.stringify(a)!==JSON.stringify(b)||
   JSON.stringify(Object.keys(b).sort())!==
     JSON.stringify(['BRAIN_CANARY_MODE','CLOCK','WORK_DB']))
  throw Error('isolated_preview_bindings_changed_during_update');
 return {status:'isolated_preview_code_updated',sourceSha:SOURCE_SHA,
  candidateVersionId:CANDIDATE_VERSION,productionVersionId:PRODUCTION_VERSION,
  previewDeploymentId:last.id,previousPreviewDeploymentId:prev.id,
  noProductionTrafficChanged:true,isolatedBindingsUnchanged:true};
}
async function run(fetcher=fetch){
 const token=process.env.CLOUDFLARE_API_TOKEN;
 if(!token)throw Error('cloudflare_isolated_preview_token_missing');
 const script=root+'/workers/scripts/'+WORKER;
 const prefix=root+'/workers/workers/'+WORKER;
 const previewPath=prefix+'/previews/'+PREVIEW_ID+'/deployments';
 const headers={Authorization:'Bearer '+token,Accept:'application/json'};
 const api=async(url,method='GET',body)=>{
  const response=await fetcher(url,{method,headers:{
   ...headers,...(body?{'Content-Type':'application/merge-patch+json'}:{})
  },body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw Error('isolated_preview_'+method+'_http_'+response.status);
  const payload=await response.json();
  if(payload?.success!==true)throw Error('isolated_preview_'+method+'_rejected');
  return payload.result;
 };
 const [production,prodVersion,stagedVersion,previews,deployments,subdomain]=await Promise.all([
  api(script+'/deployments'),api(script+'/versions/'+PRODUCTION_VERSION),
  api(script+'/versions/'+CANDIDATE_VERSION),api(prefix+'/previews'),
  api(previewPath),api(script+'/subdomain')
 ]);
 const baseline=checkPreviewPatchPreflight({production,productionVersion:prodVersion,
  stagedVersion,previews,deployments,subdomain});
 const file=process.env.BRAIN_PREVIEW_BUNDLE||'/tmp/brain-pink-preview-bundle/brain-isolated-probe.js';
 const code=readFileSync(file,'utf8'),patch=buildPatch({js:code});
 { // Refresh the reviewed diagnostic wrapper even when Brain source is unchanged.
  // Preview only; do not give this endpoint a script path, production binding,
  // owner hash or any code the model supplied. CI built the pinned source.
  await api(previewPath+'/latest','PATCH',patch);
 }
 const [after,liveAfter,subAfter]=await Promise.all([
  api(previewPath),api(script+'/deployments'),api(script+'/subdomain')
 ]);
 if(subAfter?.previews_enabled!==false||subAfter?.enabled!==true)
  throw Error('preview_url_state_changed_during_source_patch');
 const receipt=assertUpdatedPreview({before:deployments,after,
  productionBefore:production,productionAfter:liveAfter});
 console.log('Updated isolated Preview source at '+receipt.sourceSha.slice(0,12)+
  '. Separate D1 and Durable Object unchanged. Live production remained at 100%.');
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 run().catch(e=>{console.error(String(e.message||e));process.exitCode=1});
