// Verified 0%-traffic Bubbles browser staging. No token values in logs or receipts.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const mode=process.argv[2];
const account='ef25728c096c6ba92cf510caa2058003';
const token=process.env.CLOUDFLARE_API_TOKEN;
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/bubbles-cloud-browser';
const pin='fd3c9d390dc89888f571e6d011f22c4e77f72584';
const beforePath='/tmp/bubbles-browser-stage-before.json';
const receiptPath='repository-receipts/bubbles-browser-stage.json';
if(!['before','after'].includes(mode))throw Error('stage_mode_invalid');
if(!token)throw Error('moltnook_cloudflare_token_missing');
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function api(path){
 const r=await fetch(root+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('cloudflare_read_http_'+r.status);
 const body=await r.json();if(!body.success)throw Error('cloudflare_read_unsuccessful');return body.result;
}
function active(result){
 const d=(result?.deployments||result||[])[0];
 if(!d?.id||d.versions?.length!==1||d.versions[0]?.percentage!==100)throw Error('production_100_percent_baseline_missing');
 return {deploymentId:d.id,versionId:d.versions[0].version_id};
}
function summary(version){
 const source=version?.resources?.bindings;
 if(!Array.isArray(source))throw Error('cloudflare_version_bindings_missing');
 const map=new Map(source.map(b=>[b.name,b]));
 for(const [name,type] of Object.entries({BRAIN:'service',BROWSER:'browser',CONSENT:'durable_object_namespace'})){
  if(map.get(name)?.type!==type)throw Error('required_browser_binding_missing_'+name);
 }
 return Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)).map(([name,b])=>[name,{type:b.type,digest:sha(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))}]));
}
const a=active(await api('/deployments'));
if(mode==='before'){
 const binding=summary(await api('/versions/'+a.versionId));
 writeFileSync(beforePath,JSON.stringify({active:a,binding}),{mode:0o600});
 console.log('Verified active browser Worker baseline and owner, Chrome, consent binding identities.');
}else{
 const before=JSON.parse(readFileSync(beforePath,'utf8'));
 if(a.deploymentId!==before.active.deploymentId||a.versionId!==before.active.versionId)throw Error('production_traffic_changed');
 const versions=await api('/versions?per_page=4');const list=versions?.items||versions;
 if(!Array.isArray(list)||!list[0]?.id||list[0].id===a.versionId)throw Error('staged_version_absent');
 const id=list[0].id,v=await api('/versions/'+id);
 const m=String(v.annotations?.['workers/message']||'');
 if(!m.includes(pin)||!m.includes('Bubbles viewport review'))throw Error('candidate_provenance_unverified');
 if(JSON.stringify(summary(v))!==JSON.stringify(before.binding))throw Error('browser_binding_identity_changed');
 mkdirSync('repository-receipts',{recursive:true});
 writeFileSync(receiptPath,JSON.stringify({status:'staged_zero_traffic',sourceCommit:pin,stagedVersionId:id,existingActiveVersionId:a.versionId,productionDeploymentUnchanged:true,allBindingIdentitiesMatched:true,ownerConsentPreserved:true,actualAndroidScreenConnected:false,verifiedAt:new Date().toISOString()},null,2)+'\n');
 console.log('STAGING VERIFIED: Chrome, Robot Brain and consent bindings match; production traffic unchanged.');
}
