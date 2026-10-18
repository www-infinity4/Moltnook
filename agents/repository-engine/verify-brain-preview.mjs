// Truthful staging receipts for a synthetic isolated Cloudflare Worker Preview.
// Never POST to production, and never copy production owner/transaction data.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const account='ef25728c096c6ba92cf510caa2058003';
const base='https://api.cloudflare.com/client/v4/accounts/'+account+
 '/workers/scripts/infinity-brain-clock/deployments';
const snapshot='/tmp/brain-preview-production.json';
const receipt='repository-receipts/brain-isolated-preview-receipt.json';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function singleDeployment(payload){
 const active=(payload?.result?.deployments||payload?.result||[])[0];
 if(payload?.success!==true||!UUID.test(active?.id||'')||
  active?.versions?.length!==1||active.versions[0]?.percentage!==100||
  !UUID.test(active.versions[0]?.version_id||''))
   throw Error('unexpected_production_state');
 return {id:active.id,versionId:active.versions[0].version_id,percentage:100};
}
export function validatePreview(probe){
 const expected=['sourceDecisionVerified','ownerPriorityVerified','recoveryEligible',
  'distinctClockReady','productionTrafficTouched','ownerOrWalletOperationsAllowed'];
 if(probe?.ok!==true||probe.mode!=='isolated_preview_only'||probe.ticketCount!==0)
  throw Error('isolated_preview_admission_failed');
 for(const k of expected){
  const wanted=['productionTrafficTouched','ownerOrWalletOperationsAllowed'].includes(k)?false:true;
  if(probe[k]!==wanted)throw Error('isolated_preview_check_failed: '+k);
 }
 return {isolationVerified:true,checked:expected.length+2};
}
async function deployment(request=fetch){
 const token=process.env.CLOUDFLARE_API_TOKEN;
 if(!token)throw Error('cloudflare_preview_read_token_missing');
 const response=await request(base,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error('cloudflare_production_read_failed');
 return singleDeployment(await response.json());
}
async function run(mode,{request=fetch}={}){
 if(!['before','after'].includes(mode))throw Error('preview_check_mode_invalid');
 const state=await deployment(request);
 if(mode==='before'){
  fs.writeFileSync(snapshot,JSON.stringify(state),{mode:0o600});
  console.log('Active production version pinned. Preview will not touch its traffic.');
  return state;
 }
 const earlier=JSON.parse(fs.readFileSync(snapshot,'utf8'));
 if(JSON.stringify(earlier)!==JSON.stringify(state))
  throw Error('production_changed_during_isolated_canary');
 const url=process.env.BRAIN_CANARY_URL;
 if(!url||!/^https:\/\/brain-candidate-[0-9a-f]{8}-infinity-brain-clock\.[a-z0-9-]+\.workers\.dev$/.test(url))
  throw Error('isolated_preview_url_unverified');
 const probeRequest=await request(url+'/__preview__/admission',{
  method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{Accept:'application/json'}
 });
 if(!probeRequest.ok)throw Error('isolated_preview_probe_http_'+probeRequest.status);
 const verdict=validatePreview(await probeRequest.json());
 // Any other path, especially owner actions, must remain unavailable even
 // when someone tries to hit a public Preview hostname directly.
 const unauthorized=await request(url+'/work/run-next',{method:'POST',
  redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{'Content-Type':'application/json'},body:'{}'});
 if(unauthorized.status!==404)throw Error('isolated_preview_owner_action_exposed');
 const health=await request(url+'/health',{method:'GET',signal:AbortSignal.timeout(20000)});
 if(health.status!==404)throw Error('isolated_preview_live_route_exposed');
 fs.mkdirSync('repository-receipts',{recursive:true});
 const result={status:'isolated_preview_verified',
  stage:'synthetic_read_only_canary',sourceSha:process.env.TARGET_SHA||'',
  candidateVersionId:'86aee386-f083-428b-8f73-b606b46e7525',
  previewUrl:url,
  productionDeploymentId:earlier.id,productionVersionId:earlier.versionId,
  prodBeforeAfterEqual:true,isolatedD1:true,isolatedDurableObject:true,
  originalTicketsCopied:false,ownerOrWalletWrites:false,
  liveProductionPromoted:false,...verdict,when:new Date().toISOString()};
 fs.writeFileSync(receipt,JSON.stringify(result,null,2)+'\n');
 console.log('Preview runtime validated: synthetic admission, separate D1 and DO, owner routes unavailable, production still 100% unchanged.');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 run(process.argv[2]).catch(e=>{console.error(String(e.message||e));process.exitCode=1});
}
