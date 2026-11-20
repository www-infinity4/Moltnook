/** Deterministic Bubbles runbooks. Only the existing signed lease-bound host can supply adapters. */
export const PROGRAM_NAMES=Object.freeze([
 'ingress_task_parceler','stateless_branch_executor','deadlock_queue_sweeper',
 'telemetry_quant_harvester','schema_wallet_binder','state_continuity_compiler',
 'spec_to_ticket_compiler','deterministic_code_writer','dynamic_card_synthesizer',
 'sandbox_gate_enforcer','immutable_ip_notary','compute_settlement_router'
]);
const names=new Set(PROGRAM_NAMES),sha40=/^[a-f0-9]{40}$/i,sha64=/^[a-f0-9]{64}$/i;
const TICKET_FIELDS=new Set(['jobId','program','trigger','ownerHash','repository','sourceSha','sourceUrl','leaseId','fence','authorized','input']);
const safeId=s=>typeof s==='string'&&s.length>0&&s.length<=128&&/^[A-Za-z0-9._:-]+$/.test(s);
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname&&s.length<=1000}catch{return false}};
const safePath=s=>typeof s==='string'&&s.length<=240&&/^[A-Za-z0-9_./-]+$/.test(s)&&!s.startsWith('/')&&!s.split('/').some(p=>!p||p==='.'||p==='..'||/^\.(?:git|env)/i.test(p)||/^(?:secrets?|credentials?|node_modules)$/i.test(p));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=s=>{throw Error(s)};
const present=(o,k)=>typeof o?.[k]==='function'||fail('adapter_missing_'+k);
export async function jobHash(value){
 const src=JSON.stringify(value);
 if(!src||src.length>125000)fail('oversized_job');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(src));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function validateTicket(t){
 if(!isObject(t)||!names.has(t.program))fail('invalid_program');
 if(Object.keys(t).some(key=>!TICKET_FIELDS.has(key)))fail('invalid_ticket_fields');
 if(t.authorized!==true||!safeId(t.leaseId)||!Number.isSafeInteger(t.fence)||t.fence<1||t.trigger!=='owner_signed')fail('invalid_authorization');
 if(!safeId(t.jobId)||!sha64.test(t.ownerHash||''))fail('invalid_job_identity');
 if(!/^www-infinity4\/[A-Za-z0-9_.-]{1,100}$/.test(t.repository||''))fail('invalid_repository');
 if(!sha40.test(t.sourceSha||''))fail('invalid_source_sha');
 if(!safeUrl(t.sourceUrl))fail('invalid_source_url');
 if(!isObject(t.input))fail('invalid_program_input');
 // A signed intake request may still be mutated by its original caller while
 // verifyLease awaits network readback. Copy the entire JSON input before
 // handing anything to that asynchronous verifier; a shallow copy is unsafe.
 let input;
 try{input=JSON.parse(JSON.stringify(t.input));}catch{fail('invalid_program_input')}
 if(!isObject(input))fail('invalid_program_input');
 if(JSON.stringify(input).length>125000)fail('oversized_job');
 return Object.freeze({jobId:t.jobId,program:t.program,trigger:t.trigger,ownerHash:t.ownerHash,
  repository:t.repository,sourceSha:t.sourceSha,sourceUrl:t.sourceUrl,
  leaseId:t.leaseId,fence:t.fence,authorized:true,input});
}
const receipt=(status,details)=>({status,receipt:{...details,at:new Date().toISOString(),simulation:false}});
function orderDAG(tasks){
 if(!Array.isArray(tasks)||tasks.length<1||tasks.length>32)fail('invalid_tasks');
 const byId=new Map();for(const t of tasks){if(!safeId(t.id)||!Array.isArray(t.dependsOn)||t.dependsOn.length>32||byId.has(t.id))fail('invalid_task_id');byId.set(t.id,t)}
 const visited=new Set(),visiting=new Set(),order=[];
 function visit(id){if(visiting.has(id))fail('dependency_cycle');if(visited.has(id))return;
  const task=byId.get(id);if(!task)fail('unknown_dependency');visiting.add(id);
  for(const dep of task.dependsOn){if(!safeId(dep))fail('invalid_dependency');visit(dep)}
  visiting.delete(id);visited.add(id);order.push(id);
 }
 for(const id of byId.keys())visit(id);
 return order;
}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function executeProgram(raw,ctx={}){
 const t=validateTicket(raw),i=t.input;
 // User-supplied authorization flags are not proof of a signed lease.
 present(ctx,'verifyLease');
 const proof=await ctx.verifyLease(t);
 // Only an authenticated coordinator can issue this proof. Neither the
 // ticket's authorized field nor a Boolean from an unrelated lease check
 // conveys scope. Bind the issued grant to the exact job, program, pinned
 // source, owner partition, fencing generation and immutable input digest.
 const inputHash=await jobHash(t.input);
 if(!isObject(proof)||proof.verified!==true||proof.jobId!==t.jobId||
  proof.program!==t.program||proof.ownerHash!==t.ownerHash||
  proof.repository!==t.repository||proof.sourceSha!==t.sourceSha||
  proof.leaseId!==t.leaseId||proof.fence!==t.fence||
  proof.inputHash!==inputHash||typeof proof.expiresAt!=='string'||
  !Number.isFinite(Date.parse(proof.expiresAt))||
  Date.parse(proof.expiresAt)<=Date.now())fail('invalid_signed_lease');
 switch(t.program){
 case 'ingress_task_parceler':{
  const js=i.atomicJobs;if(!Array.isArray(js)||!js.length||js.length>16||js.some(j=>!safeId(j.id)||typeof j.instructions!=='string'||j.instructions.length>5000))fail('approved_atomic_jobs_required');
  if(new Set(js.map(j=>j.id)).size!==js.length)fail('duplicate_atomic_job');
  present(ctx.pool,'capacity');present(ctx.store,'enqueue');
  const capacity=await ctx.pool.capacity(t.repository);
  if(!Number.isInteger(capacity)||capacity<0)fail('unknown_pool_capacity');
  // A child queue packet is NOT a signed ticket. The parent lease is never
  // copied into a child, even if the same owner and repository are requested.
  // The canonical coordinator must atomically claim and fence each child.
  const jobs=js.map((j,n)=>({id:j.id,instructions:j.instructions,program:'stateless_branch_executor',
   ownerHash:t.ownerHash,repository:t.repository,sourceSha:t.sourceSha,sourceUrl:t.sourceUrl,
   leaseId:null,fence:null,authorized:false,claimStatus:'awaiting_independent_claim',
   ordinal:n,approvalRequired:true}));
  const stored=await ctx.store.enqueue(jobs,{dedupeKey:t.jobId,capacity});
  if(!Number.isSafeInteger(stored)||stored<0||stored>jobs.length)fail('invalid_enqueue_receipt');
  return receipt('queued',{queued:stored,capacity,executedInline:false,spawned:false,
   childrenRequireIndependentClaims:true});
 }
 case 'stateless_branch_executor':{
  if(!safePath(i.path)||!safeId(i.changeId))fail('unsafe_path_or_change');
  present(ctx.runner,'executeAtomic');
  const result=await ctx.runner.executeAtomic({...t,branch:'job/'+t.jobId,path:i.path,changeId:i.changeId});
  if(!sha40.test(result?.commitSha||'')||result.branch!=='job/'+t.jobId||result.testsPassed!==true)fail('invalid_executor_receipt');
  return receipt('source_committed',{branch:result.branch,commitSha:result.commitSha,testsPassed:true,merged:false});
 }
 case 'deadlock_queue_sweeper':{
  present(ctx.store,'findStalled');present(ctx.store,'requeue');const stalled=await ctx.store.findStalled({ownerHash:t.ownerHash,limit:25});
  if(!Array.isArray(stalled)||stalled.length>25)fail('invalid_stalled_batch');let requeued=0,blocked=0;
  for(const job of stalled){if(!safeId(job.id))continue;
   const permission=/permission|auth|grant|security|review|secret|denied|conflict/i.test(job.error||'');
   if(permission||!job.idempotent||!Number.isInteger(job.attempt)||job.attempt>=3){blocked++;continue}
   if(await ctx.store.requeue({id:job.id,ownerHash:t.ownerHash,expectedAttempt:job.attempt,nextAttempt:job.attempt+1,delayMs:1000*2**job.attempt})===true)requeued++;
  }
  return receipt('swept',{requeued,blocked,mutationScope:'owner_partition_only'});
 }
 case 'telemetry_quant_harvester':{
  if(i.consent!==true)fail('source_consent_required');if(!safeUrl(i.sourceUrl))fail('invalid_source_url');
  present(ctx.sources,'readPinned');present(ctx.store,'saveRaw');
  const evidence=await ctx.sources.readPinned({url:i.sourceUrl,sha:t.sourceSha,ownerHash:t.ownerHash});
  if(!sha64.test(evidence?.contentHash||'')||!safeUrl(evidence.source)||!/^\d{4}-\d\d-\d\dT/.test(evidence.observedAt||''))fail('unverified_source_receipt');
  const raw={id:await jobHash({jobId:t.jobId,source:evidence.source,hash:evidence.contentHash}),ownerHash:t.ownerHash,sourceUrl:evidence.source,contentHash:evidence.contentHash,observedAt:evidence.observedAt,verified:false,kind:'raw_quant'};
  await ctx.store.saveRaw(raw);return receipt('staged',{quantId:raw.id,verified:false});
 }
 case 'schema_wallet_binder':{
  const q=i.quant;if(!isObject(q)||!['code','media','telemetry','market'].includes(q.kind)||!safeUrl(q.sourceUrl)||typeof q.body!=='string'||q.body.length>64000||!/^\d{4}-\d\d-\d\dT/.test(q.observedAt||''))fail('invalid_quant_schema');
  if(q.walletAddress!==undefined||q.ownerHash!==undefined)fail('unverified_identity_binding');
  present(ctx.store,'insertQuant');const hash=await jobHash({kind:q.kind,sourceUrl:q.sourceUrl,body:q.body});
  const saved=await ctx.store.insertQuant({hash,kind:q.kind,ownerHash:t.ownerHash,sourceUrl:q.sourceUrl,observedAt:q.observedAt,payload:q.body});
  if(!isObject(saved))fail('quant_db_receipt_missing');
  return receipt('recorded',{hash,ownerHash:t.ownerHash,inserted:saved.inserted===true,walletTransfer:false});
 }
 case 'state_continuity_compiler':{
  if(!Array.isArray(i.sources)||!i.sources.length||i.sources.length>50||i.sources.some(s=>!safeId(s.id)||!sha64.test(s.hash||'')))fail('invalid_continuity_sources');
  present(ctx.store,'saveSnapshot');const version=await jobHash({sourceSha:t.sourceSha,sources:i.sources});
  await ctx.store.saveSnapshot({ownerHash:t.ownerHash,jobId:t.jobId,version,sources:i.sources,status:'proposed'});
  return receipt('proposed',{version,sourceCount:i.sources.length,overwroteInstructions:false});
 }
 case 'spec_to_ticket_compiler':{
  const order=orderDAG(i.tasks);return receipt('planned',{order,manifestHash:await jobHash(i.tasks),ticketsStaged:false});
 }
 case 'deterministic_code_writer':{
  if(!safePath(i.path)||!safeId(i.changeId))fail('unsafe_path_or_change');
  present(ctx.runner,'stagePR');const r=await ctx.runner.stagePR({...t,path:i.path,changeId:i.changeId,branch:'job/'+t.jobId});
  if(!safeUrl(r?.prUrl)||!sha40.test(r.headSha||''))fail('invalid_pr_receipt');
  return receipt('pr_staged',{prUrl:r.prUrl,headSha:r.headSha,merged:false,reviewPending:true});
 }
 case 'dynamic_card_synthesizer':{
  if(typeof i.title!=='string'||i.title.length>160||typeof i.description!=='string'||i.description.length>3000||!safeUrl(i.sourceUrl))fail('invalid_card_source');
  const html='<article class="infinity-quick-card" style="border-radius:18px;padding:20px;font-size:18px;line-height:1.45"><h2>'+escapeHtml(i.title)+'</h2><p>'+escapeHtml(i.description)+'</p><a href="'+escapeHtml(i.sourceUrl)+'" rel="noopener noreferrer" style="display:inline-flex;align-items:center;min-height:44px">View source</a></article>';
  return receipt('component_generated',{html,sourceUrl:i.sourceUrl,liveEndpointBound:false,productionDeployed:false});
 }
 case 'sandbox_gate_enforcer':{
  if(!sha40.test(i.headSha||''))fail('invalid_head_sha');present(ctx.qa,'run');
  const checks=await ctx.qa.run({repository:t.repository,headSha:i.headSha,leaseId:t.leaseId});
  const passed=checks?.unit===true&&checks?.security===true&&checks?.syntax===true;
  return receipt(passed?'tests_passed':'rejected',{headSha:i.headSha,testsPassed:passed,merged:false,independentApproval:false,checks});
 }
 case 'immutable_ip_notary':{
  if(!sha64.test(i.artifactSha||'')||!sha40.test(i.parentSha||'')||!Number.isFinite(Date.parse(i.observedAt||'')))fail('invalid_notary_artifact');
  present(ctx.crypto,'sign');present(ctx.store,'appendProof');
  const proof={artifactSha:i.artifactSha,parentSha:i.parentSha,agentId:t.jobId,claimedObservedAt:i.observedAt,signedAt:new Date().toISOString()};
  const hash=await jobHash(proof),signature=await ctx.crypto.sign(hash);
  if(typeof signature!=='string'||!signature)fail('signature_unavailable');
  await ctx.store.appendProof({ownerHash:t.ownerHash,hash,signature,proof});
  return receipt('proof_recorded',{hash,signature,ownershipEstablished:false});
 }
 case 'compute_settlement_router':{
  if(i.verifiedInvoice!==true||!safeId(i.invoiceId))fail('verified_invoice_required');
  if(i.unit!=='WORK_CREDIT'||!isObject(i.usage)||!['cpuMs','tokens','apiCalls'].every(k=>Number.isSafeInteger(i.usage[k])&&i.usage[k]>=0))fail('invalid_metering_unit');
  present(ctx,'verifyInvoice');if(await ctx.verifyInvoice({ticket:t,invoiceId:i.invoiceId,usage:i.usage})!==true)fail('unverified_invoice_signature');
  present(ctx.wallet,'settle');const settle=await ctx.wallet.settle({ownerHash:t.ownerHash,invoiceId:i.invoiceId,unit:i.unit,usage:i.usage});
  if(settle?.verified!==true||!safeId(settle.transactionId))fail('wallet_receipt_missing');
  return receipt('usage_settled',{transactionId:settle.transactionId,unit:i.unit,cashMinted:false});
 }
 default:fail('invalid_program');
 }
}
