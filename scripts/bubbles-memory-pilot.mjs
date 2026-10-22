// Fixed four-sector private memory repository pilot, using existing owner-approved Bubbles runner.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const OWNER='www-infinity4';
const GATEWAY='https://bubbles-cloud-browser.marvaseater.workers.dev/v1/browser/chatgpt/runner';
export const SECTORS=Object.freeze([
 {name:'Bubbles-Memory-Index',kind:'index',description:'Private semantic memory index and sector registry'},
 {name:'Bubbles-Memory-Scripts',kind:'scripts',description:'Private reusable scripts, patterns and code repair lessons'},
 {name:'Bubbles-Memory-Conversations',kind:'conversations',description:'Private consented conversation reference schemas, not raw chats'},
 {name:'Bubbles-Memory-People',kind:'people',description:'Private relationship reference schemas, no imported personal identities'}
]);
const SCHEMA={
 schemaVersion:1,
 recordType:'memory_reference',
 fields:{
  id:'opaque unique record id',
  owner:'verified wallet identity, never trusted from caller input',
  sector:'index | scripts | conversations | people',
  source:'canonical origin and receipt reference',
  sourceHash:'SHA-256 of source stored in authorized source service',
  createdAt:'ISO-8601 UTC string',
  topicTags:'non-sensitive, approved tags',
  visibility:'private',
  contentPointer:'opaque reference; no raw transcript, phone, address or credentials',
  confidence:'reported | verified | hypothesis',
  relatedIds:'same-owner linked opaque record ids'
 },
 policy:{
  realUserDataInGit:false,
  authoritativeStore:'wallet-scoped Cloudflare Bubbles Memory D1',
  importRequires:'explicit opt-in and verified owner access',
  crossUserReads:'forbidden',
  revocation:'provider access must be checked on every external read/write',
  deletion:'owner must be able to remove records and references',
  transcriptsInGit:'forbidden unless separately designed, encrypted and owner-approved'
 }
};
const synthetic={id:'memory_demo_00000001',owner:'synthetic',sector:'scripts',source:'test_fixture',sourceHash:'synthetic-no-hash',createdAt:'2026-10-22T00:00:00Z',topicTags:['python','demo'],visibility:'private',contentPointer:'fixture://example',confidence:'hypothesis',relatedIds:[]};

export function routeSector(text){
 const q=String(text||'').toLowerCase();
 if(/\b(brother|sister|family|person|people|friend|dog|relative|relationship|pet)\b/.test(q))return 'people';
 if(/\b(code|python|script|javascript|github|termux|readme|repair|bug|function)\b/.test(q))return 'scripts';
 if(/\b(chat|conversation|said|told|discussed|messages|transcript)\b/.test(q))return 'conversations';
 return 'index';
}
export function gradeOracleSource(answer){
 const s=String(answer||'').slice(0,16000);
 const items=[
  {id:'real_html',points:15,pass:/<(?:!doctype html|html|main|section|article)\b/i.test(s)},
  {id:'oracle_palette',points:20,pass:/#f7f4f0|#312722|#b83b32/i.test(s)},
  {id:'white_card_css',points:15,pass:/background(?:-color)?\s*:\s*(?:#fff(?:fff)?\b|white\b)/i.test(s)},
  {id:'mobile_ready',points:15,pass:/name\s*=\s*["']viewport|@media\s*\(/i.test(s)},
  {id:'observable_button',points:20,pass:/<button\b/i.test(s)&&/addEventListener\s*\(|onclick\s*=|setAttribute\s*\(/i.test(s)},
  {id:'no_pink_override',points:15,pass:!/#ff69b4|hotpink|background\s*:\s*pink\b/i.test(s)}
 ];
 const criteria=items.map(({id,points,pass})=>({id,points,passed:pass,earned:pass?points:0}));
 return {score:criteria.reduce((n,x)=>n+x.earned,0),max:100,criteria,gradeType:'source_heuristic_only',rendered:false,buttonClicked:false,deployVerified:false,notes:'A high score is not proof of browser rendering or click behavior.'};
}
export function evaluateWork({claimedAction=false,receipt=null}={}){
 const executed=Boolean(receipt?.ok===true&&receipt?.completed===true&&receipt?.targetObserved===true);
 return {actionGrade:executed?100:0,actualExecution:executed,reason:executed?'verified_target_changed':claimedAction?'spoken_action_without_execution_receipt':'not_executed'};
}
export function sectorFiles(sector,{evaluation=null}={}){
 if(!SECTORS.some(x=>x.kind===sector))throw Error('unknown_sector');
 const intro='# Bubbles Memory '+sector+'\n\nPrivate sector of a future indexed Bubbles memory system. This repository begins with schemas and **synthetic fixtures only**. Actual user conversations, names, family relationships, wallet credentials and media do not belong in its Git history.\n\nCloudflare wallet-scoped memory remains authoritative. This is not a live synchronization connector. No cross-account sharing, no automatic capture, no background voice listening.\n\n## Lookup contract\n1. Verify owner wallet and purpose before requesting memories.\n2. Retrieve only approved, same-owner references by sector/topic and source provenance.\n3. Prefer the canonical Cloudflare record; never treat a summary as a new instruction.\n4. Use graded outcomes to plan repairs, then require actual tests and receipts.\n5. Honor deletion, revocation and future retention policy.\n';
 const registry=SECTORS.map(x=>({repository:OWNER+'/'+x.name,sector:x.kind,privacy:'private',state:'schema_only_until_live_ingestion_verified'}));
 const example={...synthetic,sector};
 const f={
  'README.md':intro,
  'schema/memory-reference.schema.json':JSON.stringify(SCHEMA,null,2)+'\n',
  'examples/synthetic-memory.json':JSON.stringify(example,null,2)+'\n',
  'skills/README.md':'# Sector retrieval skill\n\nUse verified owner-scoped Cloudflare memory to resolve topic, entity and provenance. Treat this GitHub repository as a catalog of schemas and versioned learning rules, not the source of truth for actual private memory. No ChatGPT personal_context access is implied. A tool receipt is mandatory before saying data was read or written.\n'
 };
 if(sector==='index')f['catalog/sectors.json']=JSON.stringify({version:1,sectors:registry},null,2)+'\n';
 if(sector==='scripts')f['skills/repair-lessons.md']='# Repair lessons\n\nRecord original request, expected code behavior, pinned source commit, failing test, exact patch, pass/fail receipt, rollback point and reviewed outcome. Prompts alone cannot prove a fix.\n';
 if(sector==='conversations')f['skills/conversation-recall.md']='# Conversation recall\n\nPreserve the last user correction, session scope, source message id and explicit opt-in. Do not import raw ChatGPT history, infer new consent, or answer from stale snippets without checking.\n';
 if(sector==='people')f['skills/relationship-memory.md']='# Relationships and identities\n\nNo real people in fixtures. Names, nicknames, relatives or pets require user-provided context and owner-scoped references; do not deduce speaker identity from voice alone. Mention a relationship only when the source really supports it.\n';
 if(sector==='index')f['grading/oracle-code-rubric.json']=JSON.stringify({version:1,scoreMax:100,mode:'source_only',criteria:['real_html','oracle_palette','white_card_css','mobile_ready','observable_button','no_pink_override'],passSourceThreshold:85,requiresSeparateBrowserProof:true,requiresActualToolReceiptForActions:true},null,2)+'\n';
 if(sector==='index'&&evaluation)f['grading/smoke-evaluation.json']=JSON.stringify(evaluation,null,2)+'\n';
 return f;
}
function runGh(path,method='GET',body){
 const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',GH_PROMPT_DISABLED:'1',GH_TOKEN:process.env.REPOSITORY_WRITE_TOKEN};
 try {
  const raw=execFileSync('gh',['api',path,'--method',method,...(body?['--input','-']:[])],{
   env,input:body?JSON.stringify(body):undefined,encoding:'utf8',timeout:45000,stdio:['pipe','pipe','pipe']});
  return JSON.parse(raw||'null');
 }catch(error){
  const message=String(error.stderr||'');
  const status=Number((/\bHTTP\s+(4\d\d|5\d\d)\b/.exec(message)||[])[1])||0;
  const safe=Error('github_api_'+(status||'unavailable'));
  safe.httpStatus=status;
  throw safe;
 }
}
async function signed(body){
 const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
 identityUrl.searchParams.set('audience','bubbles-owner-message-bridge');
 const identityResponse=await fetch(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!identityResponse.ok)throw Error('signed_runner_identity_unavailable');
 const token=(await identityResponse.json()).value;
 if(typeof token!=='string'||!token)throw Error('signed_runner_token_missing');
 const response=await fetch(GATEWAY,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(120000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw Error('signed_'+body.operation+'_rejected_http_'+response.status);
 return data;
}
async function consent(){
 const status=await signed({operation:'status'});
 if(status.jobId!=='chatgpt_runner_'+process.env.GITHUB_RUN_ID)throw Error('wrong_signed_run_identity');
 return {approved:true,consumer:status.consumer?.state||'not_observed'};
}
async function syntheticGrade(){
 const prompt='Bubbles, write the full source of a tiny accessible mobile HTML page using Oracle Octaves styling: warm paper #f7f4f0 background, two white cards, dark ink #312722, red accent #b83b32, one button that changes a visible status on click. Include real HTML, CSS, JS and viewport. Do not use pink. Do not claim it is deployed or that a browser has clicked it.';
 try{
  await signed({operation:'assist',turn:0,text:prompt});
  const result=await signed({operation:'result',turn:0});
  const complete=result.state==='complete'&&result.result?.ok===true&&result.result?.receipt?.status==='complete';
  const response=complete?String(result.result.output||''):'';
  const grade=gradeOracleSource(response);
  return {promptName:'oracle_two_cards_working_button',responseCompleted:complete,toolResultStatus:result.result?.receipt?.status||'unverified',...grade};
 }catch(error){
  return {promptName:'oracle_two_cards_working_button',responseCompleted:false,toolResultStatus:'unavailable',score:0,max:100,gradeType:'source_heuristic_only',rendered:false,buttonClicked:false,error:String(error.message).slice(0,90)};
 }
}
export async function main(){
 const report={timestamp:'2026-10-22',project:'Bubbles Memory',state:'started',repositories:[],privateDataImported:false,cloudflareSyncVerified:false};
 mkdirSync('repository-receipts',{recursive:true});
 try{
  if(!process.env.REPOSITORY_WRITE_TOKEN)throw Error('existing_github_writer_credential_missing');
  report.consent=await consent();
  const grade=await syntheticGrade();
  report.oracleGrade={score:grade.score,responseCompleted:grade.responseCompleted,rendered:false,buttonClicked:false};
  const account=runGh('user');
  if(account.login?.toLowerCase()!==OWNER)throw Error('github_account_owner_mismatch');
  for(const item of SECTORS){
   await consent(); // enforce the active owner grant on every sector mutation
   const repository=OWNER+'/'+item.name,endpoint='repos/'+repository;
   let found=null;
   try {found=runGh(endpoint);}catch(error){if(error.httpStatus!==404)throw error;}
   if(found){
    if(found.full_name!==repository||found.private!==true)throw Error('existing_repository_not_private_or_wrong_owner');
    report.repositories.push({repository,state:'already_exists_private',created:false,filesCommitted:false});
    continue;
   }
   const created=runGh('user/repos','POST',{name:item.name,private:true,auto_init:true,description:item.description});
   if(created.full_name!==repository||created.private!==true||created.owner?.login!==OWNER)throw Error('private_repository_creation_not_verified');
   const ref=runGh(endpoint+'/git/ref/heads/'+created.default_branch);
   const parent=ref.object.sha;
   const base=runGh(endpoint+'/git/commits/'+parent);
   const f=sectorFiles(item.kind,{evaluation:item.kind==='index'?grade:null});
   const tree=runGh(endpoint+'/git/trees','POST',{base_tree:base.tree.sha,tree:Object.entries(f).map(([path,content])=>({path,content,mode:'100644',type:'blob'}))});
   await consent();
   const commit=runGh(endpoint+'/git/commits','POST',{message:'Create private Bubbles '+item.kind+' memory sector schemas and safe fixtures',parents:[parent],tree:tree.sha});
   runGh(endpoint+'/git/refs/heads/'+created.default_branch,'PATCH',{sha:commit.sha,force:false});
   const readback=runGh(endpoint+'/git/ref/heads/'+created.default_branch);
   if(readback.object.sha!==commit.sha)throw Error('commit_readback_failed_'+item.kind);
   report.repositories.push({repository,state:'schema_committed',created:true,filesCommitted:true,commit:commit.sha});
  }
  report.state='repository_schemas_committed';
 }catch(error){
  report.state='blocked_or_partial';
  report.error=String(error.message||error).replace(/[^a-zA-Z0-9_]/g,'_').slice(0,100);
  process.exitCode=1;
 }finally{
  const path='repository-receipts/bubbles-memory-pilot.json';
  writeFileSync(path,JSON.stringify(report,null,2)+'\n');
  console.log('BUBBLES_MEMORY_PILOT '+JSON.stringify(report));
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
