import test from 'node:test';
import assert from 'node:assert/strict';
import {PROGRAM_NAMES, validateTicket, executeProgram, jobHash} from './job-programs.mjs';

const sha='a'.repeat(40);
const base={jobId:'JOB-1907-01',ownerHash:'b'.repeat(64),repository:'www-infinity4/Moltnook',sourceSha:sha,sourceUrl:'https://github.com/www-infinity4/Moltnook/issues/252',leaseId:'lease-1',fence:1,authorized:true};
const ticket=(program,input={})=>({...base,program,input,trigger:'owner_signed'});
const signedScope=async t=>({verified:true,jobId:t.jobId,program:t.program,ownerHash:t.ownerHash,
 repository:t.repository,sourceSha:t.sourceSha,leaseId:t.leaseId,fence:t.fence,
 inputHash:await jobHash(t.input),expiresAt:new Date(Date.now()+60000).toISOString()});
const ctx=(overrides={})=>({verifyLease:signedScope,verifyInvoice:async()=>true,pool:{capacity:async()=>2},store:{enqueue:async jobs=>jobs.length,findStalled:async()=>[],requeue:async()=>true,saveRaw:async v=>v,insertQuant:async()=>({inserted:true}),saveSnapshot:async v=>v,appendProof:async v=>v},runner:{executeAtomic:async job=>({commitSha:sha,branch:job.branch,testsPassed:true}),stagePR:async()=>({prUrl:'https://github.com/www-infinity4/Moltnook/pull/300',headSha:sha})},sources:{readPinned:async()=>({source:'https://example.org/',contentHash:'c'.repeat(64),observedAt:'2026-11-19T00:00:00Z'})},qa:{run:async()=>({unit:true,security:true,syntax:true})},wallet:{settle:async()=>({transactionId:'wallet-1',verified:true})},crypto:{sign:async()=>('signed-proof')},...overrides});

test('all twelve named programs exist',()=>{
 assert.equal(PROGRAM_NAMES.length,12);
 assert.equal(new Set(PROGRAM_NAMES).size,12);
 assert.throws(()=>validateTicket(ticket('unlisted')),/invalid_program/);
});
test('signed scope, pinned SHA and bounded input are mandatory',()=>{
 assert.throws(()=>validateTicket({...ticket('ingress_task_parceler'),authorized:false}),/authorization/);
 assert.throws(()=>validateTicket({...ticket('ingress_task_parceler'),repository:'attacker/evil'}),/repository/);
 assert.throws(()=>validateTicket({...ticket('ingress_task_parceler'),sourceSha:'HEAD'}),/source_sha/);
 assert.throws(()=>validateTicket({...ticket('ingress_task_parceler'),input:{raw:'x'.repeat(130000)}}),/oversized/);
});
test('caller authorization bit does not replace independent signed lease verifier',async()=>{
 await assert.rejects(()=>executeProgram(ticket('ingress_task_parceler',{atomicJobs:[{id:'a',instructions:'x'}]}),{}),/adapter_missing_verifyLease/);
 await assert.rejects(()=>executeProgram(ticket('ingress_task_parceler',{atomicJobs:[{id:'a',instructions:'x'}]}),ctx({verifyLease:async()=>false})),/invalid_signed_lease/);
});
test('orange parcels approved atomic tasks',async()=>{
 const atomic=[{id:'a',instructions:'Inspect runner'},{id:'b',instructions:'Test adapter'}];
 const r=await executeProgram(ticket('ingress_task_parceler',{atomicJobs:atomic}),ctx());
 assert.equal(r.status,'queued');assert.equal(r.receipt.queued,2);
 await assert.rejects(()=>executeProgram(ticket('ingress_task_parceler',{prompt:'unreviewed',atomicJobs:[]}),ctx()),/approved_atomic_jobs/);
});
test('clone worker never executes unsafe paths',async()=>{
 const r=await executeProgram(ticket('stateless_branch_executor',{path:'agents/jobs.json',changeId:'safe-step'}),ctx());
 assert.match(r.receipt.branch,/^job\/JOB-1907-01-[a-f0-9]{12}$/);
 await assert.rejects(()=>executeProgram(ticket('stateless_branch_executor',{path:'../.env',changeId:'x'}),ctx()),/unsafe_path/);
});
test('red retries only idempotent jobs, not permission failures',async()=>{
 let retried=[];const c=ctx({store:{findStalled:async()=>[{id:'a',attempt:1,idempotent:true,error:'timeout'},{id:'b',attempt:0,idempotent:true,error:'permission_denied'},{id:'c',attempt:3,idempotent:true,error:'timeout'}],requeue:async j=>{retried.push(j.id);return true;}}});
 const r=await executeProgram(ticket('deadlock_queue_sweeper',{}),c);
 assert.deepEqual(retried,['a']);assert.equal(r.receipt.requeued,1);
});
test('yellow stages unverified provenance only when source consent exists',async()=>{
 const r=await executeProgram(ticket('telemetry_quant_harvester',{sourceUrl:'https://example.org/a',consent:true}),ctx());
 assert.equal(r.receipt.verified,false);
 await assert.rejects(()=>executeProgram(ticket('telemetry_quant_harvester',{sourceUrl:'https://example.org/a',consent:false}),ctx()),/consent/);
});
test('blue retains validated owner scope and no wallet transfer',async()=>{
 const r=await executeProgram(ticket('schema_wallet_binder',{quant:{kind:'code',sourceUrl:'https://example.org',body:'a',observedAt:'2026-11-19T00:00:00Z'}}),ctx());
 assert.equal(r.status,'recorded');assert.equal(r.receipt.ownerHash,base.ownerHash);
 assert.equal(r.receipt.walletTransfer,false);
 await assert.rejects(()=>executeProgram(ticket('schema_wallet_binder',{quant:{kind:'code',sourceUrl:'https://example.org',body:'a',walletAddress:'bad',observedAt:'2026-11-19T00:00:00Z'}}),ctx()),/identity_binding/);
});
test('purple saves versioned proposal not mutable instructions',async()=>{
 const r=await executeProgram(ticket('state_continuity_compiler',{sources:[{id:'a',hash:'c'.repeat(64)}]}),ctx());
 assert.equal(r.status,'proposed');assert.equal(r.receipt.overwroteInstructions,false);
});
test('green planner orders dependencies and rejects cycles',async()=>{
 const accepted=await executeProgram(ticket('spec_to_ticket_compiler',{tasks:[{id:'one',dependsOn:[]},{id:'two',dependsOn:['one']}]}),ctx());
 assert.deepEqual(accepted.receipt.order,['one','two']);
 await assert.rejects(()=>executeProgram(ticket('spec_to_ticket_compiler',{tasks:[{id:'one',dependsOn:['two']},{id:'two',dependsOn:['one']}]}),ctx()),/dependency_cycle/);
});
test('green writer stages PR only',async()=>{
 const r=await executeProgram(ticket('deterministic_code_writer',{path:'agents/jobs.json',changeId:'a'}),ctx());
 assert.match(r.receipt.prUrl,/github.com/);assert.equal(r.status,'pr_staged');assert.equal(r.receipt.merged,false);
});
test('Quick Card escapes untrusted content and meets minimum tap height',async()=>{
 const r=await executeProgram(ticket('dynamic_card_synthesizer',{title:'<script>x</script>',description:'Source',sourceUrl:'https://example.org/a'}),ctx());
 assert.doesNotMatch(r.receipt.html,/<script>/);assert.match(r.receipt.html,/&lt;script&gt;/);
 assert.match(r.receipt.html,/min-height:44px/);assert.equal(r.receipt.productionDeployed,false);
});
test('pink sandbox cannot approve or merge from tests alone',async()=>{
 const r=await executeProgram(ticket('sandbox_gate_enforcer',{headSha:sha}),ctx());
 assert.equal(r.receipt.testsPassed,true);assert.equal(r.receipt.merged,false);assert.equal(r.receipt.independentApproval,false);
});
test('notary signs proof of existence, not IP ownership',async()=>{
 const r=await executeProgram(ticket('immutable_ip_notary',{artifactSha:'c'.repeat(64),parentSha:sha,observedAt:'2026-11-19T00:00:00Z'}),ctx());
 assert.equal(r.receipt.signature,'signed-proof');assert.equal(r.receipt.ownershipEstablished,false);
});
test('credit settlement cannot forge monetary value or self-verify invoices',async()=>{
 const r=await executeProgram(ticket('compute_settlement_router',{usage:{cpuMs:100,tokens:40,apiCalls:2},invoiceId:'signed-invoice-1',verifiedInvoice:true,unit:'WORK_CREDIT'}),ctx());
 assert.equal(r.receipt.transactionId,'wallet-1');assert.equal(r.receipt.cashMinted,false);
 await assert.rejects(()=>executeProgram(ticket('compute_settlement_router',{usage:{cpuMs:1},invoiceId:'claim',verifiedInvoice:false,unit:'USD'}),ctx()),/verified_invoice|unit/);
 await assert.rejects(()=>executeProgram(ticket('compute_settlement_router',{usage:{cpuMs:1,tokens:1,apiCalls:1},invoiceId:'claim',verifiedInvoice:true,unit:'WORK_CREDIT'}),ctx({verifyInvoice:async()=>false})),/unverified_invoice_signature/);
});
test('digest deterministic',async()=>{
 assert.equal(await jobHash({a:1,b:2}),await jobHash({a:1,b:2}));
});


test('overflow child packets cannot inherit the intake writer lease or fence',async()=>{
 let submitted=null;
 const c=ctx({store:{enqueue:async jobs=>{submitted=jobs;return jobs.length;}}});
 const r=await executeProgram(ticket('ingress_task_parceler',{atomicJobs:[{id:'safe-child',instructions:'Inspect source'}]}),c);
 assert.equal(r.status,'queued');
 assert.equal(submitted.length,1);
 assert.equal(submitted[0].leaseId,null);
 assert.equal(submitted[0].fence,null);
 assert.equal(submitted[0].authorized,false);
 assert.equal(submitted[0].claimStatus,'awaiting_independent_claim');
});
test('ticket input is snapshotted before asynchronous lease checking',async()=>{
 const raw=ticket('state_continuity_compiler',{sources:[{id:'original',hash:'c'.repeat(64)}]});
 let allow;
 const permit=new Promise(resolve=>{allow=resolve});
 let persisted;
 const c=ctx({verifyLease:async t=>{await permit;return signedScope(t)},store:{saveSnapshot:async v=>{persisted=v;return v}}});
 const operation=executeProgram(raw,c);
 raw.input.sources[0].id='tampered';
 allow();
 await operation;
 assert.equal(persisted.sources[0].id,'original');
});
test('unexpected ticket properties are rejected as the public contract declares',()=>{
 assert.throws(()=>validateTicket({...ticket('spec_to_ticket_compiler',{tasks:[]}),untrustedScope:'owner-anywhere'}),/invalid_ticket_fields/);
});
test('enqueue adapter must return a bounded verified count',async()=>{
 const c=ctx({store:{enqueue:async()=>999}});
 await assert.rejects(()=>executeProgram(ticket('ingress_task_parceler',{atomicJobs:[{id:'a',instructions:'Check repo'}]}),c),/invalid_enqueue_receipt/);
});


test('a bare Boolean lease approval is not an immutable scope receipt',async()=>{
 const raw=ticket('spec_to_ticket_compiler',{tasks:[{id:'one',dependsOn:[]}]});
 await assert.rejects(()=>executeProgram(raw,ctx({verifyLease:async()=>true})),/invalid_signed_lease/);
});

test('the scoped lease must match the program, input digest and expiry',async()=>{
 const raw=ticket('spec_to_ticket_compiler',{tasks:[{id:'a',dependsOn:[]}]});
 await assert.rejects(()=>executeProgram(raw,ctx({verifyLease:async t=>({...await signedScope(t),program:'compute_settlement_router'})})),/invalid_signed_lease/);
 await assert.rejects(()=>executeProgram(raw,ctx({verifyLease:async t=>({...await signedScope(t),inputHash:'0'.repeat(64)})})),/invalid_signed_lease/);
 await assert.rejects(()=>executeProgram(raw,ctx({verifyLease:async t=>({...await signedScope(t),expiresAt:'2020-01-01T00:00:00Z'})})),/invalid_signed_lease/);
});


test('branch refs are Git-safe and collision-resistant for scoped job IDs',async()=>{
 const raw={...ticket('stateless_branch_executor',{path:'agents/safe.mjs',changeId:'edit'}),jobId:'ticket:10.2'};
 let given;
 const worker=ctx({runner:{executeAtomic:async data=>{
  given=data.branch;
  return {commitSha:sha,branch:data.branch,testsPassed:true};
 }}});
 const r=await executeProgram(raw,worker);
 assert.match(given,/^job\/[A-Za-z0-9_-]+$/);
 assert.equal(r.receipt.branch,given);
 const similar={...raw,jobId:'ticket.10:2'};
 const r2=await executeProgram(similar,worker);
 assert.notEqual(r2.receipt.branch,r.receipt.branch);
});
