/*
 * Moltnook is the central keeper of the owner's all-repository GitHub PAT.
 * QuantaPhi source is checked out read-only. This verifier uses a SEPARATE
 * Cloudflare credential only for the 0%-traffic Worker staging gate.
 *
 * Never print/return credentials, plaintext binding values, or owner hash.
 * Never use the GitHub PAT as the Cloudflare API token.
 * Never POST a production deployment from this script.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const REQUIRED_BINDINGS=Object.freeze({
 BOT_WALLET:'service',BOT_WORK_SECRET:'secret_text',
 CLOCK:'durable_object_namespace',MODELS:'service',
 WORK_DB:'d1',WRITER_AI:'ai',WRITER_OWNER_HASH:'plain_text'
});
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SHA=/^[a-f0-9]{40}$/;
const STAGED='/tmp/moltnook-brain-cloudflare-before.json';
const RECEIPT='repository-receipts/moltnook-brain-stage.json';
const SCRIPT='infinity-brain-clock';
const sha256=value=>createHash('sha256').update(value).digest('hex');
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
export function safeBindingDigests(version){
 const list=version?.resources?.bindings;
 if(!Array.isArray(list))throw Error('version_bindings_unavailable');
 const byName=new Map();
 for(const binding of list){
  if(typeof binding?.name!=='string'||typeof binding?.type!=='string'||
    byName.has(binding.name))throw Error('invalid_or_duplicate_binding');
  byName.set(binding.name,binding);
 }
 for(const [name,type] of Object.entries(REQUIRED_BINDINGS))
  if(byName.get(name)?.type!==type)throw Error('required_binding_missing_or_changed: '+name);
 return Object.fromEntries([...byName].sort(([a],[b])=>a.localeCompare(b)).map(([name,b])=>
  [name,{type:b.type,sha256:sha256(JSON.stringify(stable(b)))}]));
}
export function live100Percent(deployments){
 const list=deployments?.deployments||deployments;
 const active=Array.isArray(list)?list[0]:null;
 if(!UUID.test(active?.id||'')||active.versions?.length!==1||
  !UUID.test(active.versions[0]?.version_id||'')||active.versions[0]?.percentage!==100)
   throw Error('existing_100_percent_deployment_not_verified');
 return {id:active.id,versionId:active.versions[0].version_id};
}
export function compareStaged({before,activeAfter,candidate,expectedCommit,candidateId}){
 if(!SHA.test(expectedCommit||''))throw Error('staged_source_sha_invalid');
 if(activeAfter?.id!==before?.active?.id||
  activeAfter?.versionId!==before?.active?.versionId)
  throw Error('production_traffic_changed_during_staging');
 if(!UUID.test(candidateId||'')||candidateId===before.active.versionId||
  candidate?.id!==candidateId)throw Error('no_new_immutable_candidate');
 const note=String(candidate.annotations?.['workers/message']||'');
 if(!note.includes(expectedCommit)||!note.includes('Verified Brain source'))
  throw Error('candidate_source_provenance_unverified');
 const after=safeBindingDigests(candidate);
 const names=Object.keys(before.bindings||{});
 if(JSON.stringify(names)!==JSON.stringify(Object.keys(after)))
  throw Error('candidate_binding_list_changed');
 for(const name of names){
  if(before.bindings[name]?.type!==after[name]?.type||
     before.bindings[name]?.sha256!==after[name]?.sha256)
   throw Error('candidate_binding_identity_changed: '+name);
 }
 return {status:'staged_zero_traffic',candidateVersionId:candidateId,
  previousVersionId:before.active.versionId,productionDeploymentId:before.active.id,
  targetGitSha:expectedCommit,productionTrafficUnchanged:true,canaryPromoted:false,
  bindingIdentitiesVerified:true,bindingNames:names,verifiedAt:new Date().toISOString()};
}
async function run(mode,{request=fetch}={}){
 if(!['before','after'].includes(mode))throw Error('stage_mode_not_supported');
 const token=process.env.CLOUDFLARE_API_TOKEN;
 const account=process.env.CLOUDFLARE_ACCOUNT_ID||'ef25728c096c6ba92cf510caa2058003';
 if(!token)throw Error('moltnook_cloudflare_api_token_not_configured');
 if(!/^[a-f0-9]{32}$/.test(account))throw Error('cloudflare_account_id_invalid');
 const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+SCRIPT;
 const api=async path=>{
  const response=await request(root+path,{
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   redirect:'error',signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw Error('cloudflare_read_'+response.status);
  const json=await response.json();
  if(json?.success!==true)throw Error('cloudflare_read_unverified');
  return json.result;
 };
 if(mode==='before'){
  const active=live100Percent(await api('/deployments'));
  const baselineVersion=await api('/versions/'+active.versionId);
  const baseline={active,bindings:safeBindingDigests(baselineVersion)};
  writeFileSync(STAGED,JSON.stringify(baseline),{mode:0o600});
  console.log('Production 100% baseline verified, including owner identity and wallet binding digests. No deployment changed.');
  return baseline;
 }
 const before=JSON.parse(readFileSync(STAGED,'utf8'));
 const activeAfter=live100Percent(await api('/deployments'));
 const versions=await api('/versions?per_page=5');
 const items=versions?.items||versions;
 if(!Array.isArray(items)||items.length<1)throw Error('candidate_versions_missing');
 const candidateId=items[0]?.id;
 if(!UUID.test(candidateId||''))throw Error('candidate_version_invalid');
 const candidate=await api('/versions/'+candidateId);
 const receipt=compareStaged({
  before,activeAfter,candidate,expectedCommit:process.env.TARGET_SHA,candidateId
 });
 mkdirSync('repository-receipts',{recursive:true});
 writeFileSync(RECEIPT,JSON.stringify(receipt,null,2)+'\n');
 console.log('Staging VERIFIED: all required binding digests match, the active 100% version is unchanged, and the new immutable version has 0% traffic.');
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 run(process.argv[2]).catch(error=>{console.error(String(error.message||error));process.exitCode=1;});
}
