// Read-only preflight for an EXISTING isolated Cloudflare Preview.
// A Wrangler preview command may return 10500 after Cloudflare has already
// successfully created the Preview. Reuse the verified deployment instead of
// posting an unnecessary update. This script cannot deploy production.
import {pathToFileURL} from 'node:url';
import {appendFileSync} from 'node:fs';
const ACCOUNT='ef25728c096c6ba92cf510caa2058003';
const WORKER='infinity-brain-clock';
const SLUG='brain-candidate-26518e96';
const SOURCE_SHA='26518e9645024ad2f18e7550171863c11a8e3ec8';
const CANARY_DB='76deaa98-5d3a-4151-8390-e14d7da87cb3';
export const expectedSlug=SLUG;
const uuid32=/^[a-f0-9]{32}$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
export function reuseDecision({previews,deployments,productionNamespace,expectedSource=SOURCE_SHA}){
 const items=Array.isArray(previews)?previews:previews?.items;
 if(!Array.isArray(items))throw Error('preview_inventory_unavailable');
 if(items.length>1)throw Error('multiple_preview_routes_not_allowed');
 if(items.length===0)return {reuse:false,reason:'preview_not_created'};
 const record=items[0];
 if(record.slug!==SLUG||!uuid32.test(record.id||''))throw Error('unexpected_preview_slug_or_id');
 const deploys=Array.isArray(deployments)?deployments:deployments?.items;
 if(!Array.isArray(deploys)||!deploys.length)throw Error('preview_deployment_missing');
 const latest=deploys[0];
 const env=latest.env||{};
 const actualKeys=Object.keys(env).sort();
 if(JSON.stringify(actualKeys)!==JSON.stringify(['BRAIN_CANARY_MODE','CLOCK','WORK_DB']))
  throw Error('preview_forbidden_runtime_binding');
 if(env.BRAIN_CANARY_MODE?.text!=='isolated'||env.BRAIN_CANARY_MODE?.type!=='plain_text'||
    env.CLOCK?.type!=='durable_object_namespace'||
    !uuid32.test(env.CLOCK?.namespace_id||'')||
    env.CLOCK.namespace_id===productionNamespace||
    env.WORK_DB?.type!=='d1'||env.WORK_DB?.database_id!==CANARY_DB)
  throw Error('preview_isolation_unverified');
 if(latest.main_module!=='brain-isolated-probe.js')
  throw Error('preview_probe_module_invalid');
 if(latest.annotations?.['workers/tag']!==expectedSource.slice(0,7))
  throw Error('preview_source_revision_mismatch');
 if(!uuid.test(latest.id||''))throw Error('preview_deployment_id_invalid');
 return {reuse:true,previewId:record.id,deploymentId:latest.id,
  reason:'verified_preview_already_exists'};
}
export async function preflight({fetcher=fetch,token=process.env.CLOUDFLARE_API_TOKEN}={}){
 if(!token)throw Error('cloudflare_preview_credential_missing');
 const api=async uri=>{
  const response=await fetcher(root+uri,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   redirect:'error',signal:AbortSignal.timeout(16000)});
  const payload=await response.json();
  if(!response.ok||payload.success!==true)
   throw Error('cloudflare_preview_read_unavailable');
  return payload.result;
 };
 const [previews,live,activeVersion]=await Promise.all([
  api('/workers/workers/'+WORKER+'/previews?per_page=20'),
  api('/workers/scripts/'+WORKER+'/deployments'),
  api('/workers/scripts/'+WORKER+'/versions/bb324bd0-d25f-4684-bd43-5abc1e06b667')
 ]);
 const deployed=(live?.deployments||live||[])[0];
 if(!deployed||deployed.versions?.length!==1||
   deployed.versions[0].version_id!=='bb324bd0-d25f-4684-bd43-5abc1e06b667'||
   deployed.versions[0].percentage!==100)
  throw Error('production_release_is_no_longer_100_percent_stable');
 const namespace=activeVersion?.resources?.bindings?.find(b=>b.name==='CLOCK')?.namespace_id;
 if(!uuid32.test(namespace||''))throw Error('production_clock_namespace_unavailable');
 const items=Array.isArray(previews)?previews:previews?.items;
 let deployments=[];
 if(items?.length===1&&items[0]?.slug===SLUG)
  deployments=await api('/workers/workers/'+WORKER+'/previews/'+items[0].id+'/deployments');
 return reuseDecision({previews,deployments,productionNamespace:namespace});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const choice=await preflight();
  if(process.env.GITHUB_ENV)
   appendFileSync(process.env.GITHUB_ENV,'PREVIEW_NEEDS_CREATE='+(choice.reuse?'0':'1')+'\n');
  console.log(choice.reuse?
   'Reusing verified isolated Preview deployment. No new upload or change to production.' :
   'No existing Preview; a new isolated one is required.');
 }catch(e){console.error(String(e.message||e));process.exitCode=1;}
}
