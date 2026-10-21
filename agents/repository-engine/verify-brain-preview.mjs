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
  'distinctClockReady','productionTrafficTouched','ownerOrWalletOperationsAllowed',
  'mergedSourceRecognized','reviewReceiptSafe','generatedRepairSuperseded','ownerBlockPreserved'];
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
 // Before exposing Preview URLs, prove this Worker has only our isolated
 // Preview. Public Preview URLs are opt-in and may expose any other Preview.
 const workerRoot='https://api.cloudflare.com/client/v4/accounts/'+account+
  '/workers/workers/infinity-brain-clock';
 const scriptRoot='https://api.cloudflare.com/client/v4/accounts/'+account+
  '/workers/scripts/infinity-brain-clock';
 const token=process.env.CLOUDFLARE_API_TOKEN;
 const api=async(url,method='GET',body)=>{
  const response=await request(url,{method,headers:{
   Authorization:'Bearer '+token,Accept:'application/json',
   ...(body?{'Content-Type':'application/json'}:{})
  },body:body?JSON.stringify(body):undefined,redirect:'error',
  signal:AbortSignal.timeout(15000)});
  const payload=await response.json();
  if(!response.ok||payload?.success!==true)
   throw Error('cloudflare_preview_control_rejected_'+method+'_'+response.status);
  return payload.result;
 };
 const previews=await api(workerRoot+'/previews?per_page=20');
 const items=previews?.items||previews;
 if(!Array.isArray(items)||items.length!==1||
    items[0]?.slug!=='brain-candidate-26518e96')
  throw Error('unexpected_extra_preview_or_missing_isolated_preview');
 const previewId=items[0].id;
 const deploymentList=await api(workerRoot+'/previews/'+previewId+'/deployments');
 const previewDeployment=deploymentList?.items?.[0]||deploymentList?.[0];
 if(previewDeployment?.annotations?.['workers/tag']!=='92c0e39')
  throw Error('isolated_preview_source_version_not_updated');
 if(previewDeployment.compatibility_date!=='2026-10-10'||
   JSON.stringify([...(previewDeployment.compatibility_flags||[])].sort())!==JSON.stringify(['global_fetch_strictly_public']))
  throw Error('isolated_preview_runtime_flags_unverified');
 const env=previewDeployment?.env||{};
 const required=Object.keys(env).sort();
 if(JSON.stringify(required)!==JSON.stringify(['BRAIN_CANARY_MODE','CLOCK','WORK_DB'])||
    env.BRAIN_CANARY_MODE?.text!=='isolated'||
    env.WORK_DB?.database_id!=='76deaa98-5d3a-4151-8390-e14d7da87cb3'||
    env.CLOCK?.type!=='durable_object_namespace')
  throw Error('preview_environment_uses_production_bindings');
 const version=await api(scriptRoot+'/versions/'+earlier.versionId);
 const stableClock=version?.resources?.bindings?.find(b=>b.name==='CLOCK')?.namespace_id;
 if(!stableClock||stableClock===env.CLOCK.namespace_id)
  throw Error('preview_durable_object_not_isolated');
 const originalRoute=await api(scriptRoot+'/subdomain');
 if(originalRoute?.enabled!==true||originalRoute?.previews_enabled!==false)
  throw Error('existing_preview_routing_state_unexpected');

 // Make the test-only Preview briefly routable. In all cases, disable URL
 // routing again. The actual 100% production deployment is never mutated.
 const url='https://brain-candidate-26518e96-infinity-brain-clock.marvaseater.workers.dev';
 let verdict,firstHTTP=0;
 try{
  await api(scriptRoot+'/subdomain','POST',{enabled:true,previews_enabled:true});
  const currentPreview=await api(workerRoot+'/previews/'+previewId);
  if(!currentPreview?.urls?.includes(url))
   throw Error('expected_isolated_preview_url_missing');
  let probeRequest;
  for(let attempt=0;attempt<8;attempt++){
   try{
    probeRequest=await request(url+'/__preview__/admission',{
     method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),
     headers:{Accept:'application/json'}});
    firstHTTP=probeRequest.status;
    if(probeRequest.ok)break;
   }catch(error){firstHTTP=0;}
   if(attempt<7)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!probeRequest?.ok)
   throw Error('isolated_preview_probe_http_'+firstHTTP);
  const observedProbe=await probeRequest.json();
  verdict={...validatePreview(observedProbe),consentTransport:observedProbe.consentTransport,
   compatibilityFlags:[...previewDeployment.compatibility_flags]};
  console.log('CONSENT_TRANSPORT_DIAGNOSTIC '+JSON.stringify(observedProbe.consentTransport||{error:'unavailable'}));
  if(verdict.consentTransport?.httpStatus!==401||verdict.consentTransport?.error!=='bridge_runner_not_verified'||verdict.consentTransport?.reachable!==true)
   throw Error('candidate_consent_endpoint_not_reachable');

  // Any other path, especially owner actions, must remain unavailable.
  const unauthorized=await request(url+'/work/run-next',{method:'POST',
   redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{'Content-Type':'application/json'},body:'{}'});
  if(unauthorized.status!==404)throw Error('isolated_preview_owner_action_exposed');
  const health=await request(url+'/health',{method:'GET',signal:AbortSignal.timeout(20000)});
  if(health.status!==404)throw Error('isolated_preview_live_route_exposed');
 }finally{
  // Restore even if the enable call changed state but its reply was lost.
  await api(scriptRoot+'/subdomain','POST',{enabled:true,previews_enabled:false});
  const restored=await api(scriptRoot+'/subdomain');
  if(restored?.previews_enabled!==false||restored?.enabled!==true)
   throw Error('preview_route_disable_unverified');
 }
 const afterwards=await deployment(request);
 if(JSON.stringify(earlier)!==JSON.stringify(afterwards))
  throw Error('production_changed_after_isolated_runtime_test');
 fs.mkdirSync('repository-receipts',{recursive:true});
 const result={status:'isolated_preview_verified',
  stage:'synthetic_read_only_canary',sourceSha:process.env.TARGET_SHA||'',
  candidateVersionId:'f00ef78a-d044-4437-868b-73dcc0dd61d8',
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
