import test from 'node:test';
import assert from 'node:assert/strict';
import {planOwnerDispatch,buildWorkerContext,checkWorkerResult} from './owner-dispatch.mjs';

const sha='a'.repeat(40);
const job=(id,overrides={})=>({id,repository:'www-infinity4/Moltnook',baseSha:sha,leaseId:'lease-'+id,priority:'normal',kind:'card',access:'write',targetPaths:['cards/'+id+'.mjs'],dependencies:[],...overrides});

test('empty queue makes no fictitious worker or completion',()=>{
 const plan=planOwnerDispatch([]);
 assert.deepEqual(plan.direct,[]);assert.deepEqual(plan.overflow,[]);
 assert.equal(plan.workExecuted,false);assert.equal(plan.mergeAuthorized,false);
});
test('infrastructure and critical jobs outrank cards when all are ready',()=>{
 const plan=planOwnerDispatch([job('card'),job('schema',{kind:'infrastructure'}),job('security',{priority:'critical',kind:'security'})],{directCapacity:2});
 assert.deepEqual(plan.direct.map(x=>x.id),['security','schema']);
 assert.deepEqual(plan.waiting.map(x=>x.id),['card']);
});
test('dependencies stay blocked until an external verified-completion set includes them',()=>{
 const jobs=[job('ui',{dependencies:['schema']}),job('schema',{kind:'infrastructure'})];
 const one=planOwnerDispatch(jobs,{directCapacity:2});
 assert.deepEqual(one.direct.map(x=>x.id),['schema']);
 assert.equal(one.waiting.find(x=>x.id==='ui')?.reason,'dependency_incomplete');
 const two=planOwnerDispatch([job('ui',{dependencies:['schema']})],{completedIds:['schema']});
 assert.deepEqual(two.direct.map(x=>x.id),['ui']);
});
test('unknown dependencies and dependency cycles fail closed',()=>{
 assert.equal(planOwnerDispatch([job('ui',{dependencies:['missing']})]).blocked[0].reason,'unknown_dependency');
 const cycled=planOwnerDispatch([job('a',{dependencies:['b']}),job('b',{dependencies:['a']})],{directCapacity:2});
 assert.equal(cycled.blocked.length,2);
 assert.ok(cycled.blocked.every(x=>x.reason==='dependency_cycle'));
});
test('overlapping exact paths may never be dispatched concurrently',()=>{
 const plan=planOwnerDispatch([job('a',{targetPaths:['src/app.mjs']}),job('b',{targetPaths:['src/app.mjs']})],{directCapacity:2});
 assert.equal(plan.direct.length,1);
 assert.equal(plan.waiting[0].reason,'write_path_conflict');
});
test('write scope is isolated by repository rather than path basename alone',()=>{
 const plan=planOwnerDispatch([job('a',{targetPaths:['src/app.mjs']}),job('b',{repository:'www-infinity4/QuantaPhi',targetPaths:['src/app.mjs']})],{directCapacity:2});
 assert.equal(plan.direct.length,2);
});
test('read-only overflow needs explicit capacity and does not grant execution authority',()=>{
 const plan=planOwnerDispatch([job('a'),job('b',{access:'read'}),job('c',{access:'read'})],{directCapacity:1,overflowCapacity:1,allowReadOverflow:true});
 assert.deepEqual(plan.direct.map(x=>x.id),['a']);
 assert.deepEqual(plan.overflow.map(x=>x.id),['b']);
 assert.equal(plan.overflow[0].requiresIndependentClaim,true);
 assert.equal(plan.waiting.find(x=>x.id==='c').reason,'capacity_reached');
 assert.equal(plan.executionAuthorized,false);
});
test('write jobs never inherit read-only overflow privilege',()=>{
 const plan=planOwnerDispatch([job('a'),job('b')],{directCapacity:1,overflowCapacity:4,allowReadOverflow:true});
 assert.deepEqual(plan.overflow,[]);
 assert.equal(plan.waiting[0].reason,'independent_write_lease_required');
});
test('rejects duplicate IDs, invalid refs and sensitive paths',()=>{
 assert.throws(()=>planOwnerDispatch([job('a'),job('a')]),/duplicate/);
 assert.throws(()=>planOwnerDispatch([job('x',{baseSha:'main'})]),/baseSha/);
 assert.throws(()=>planOwnerDispatch([job('x',{targetPaths:['.env']})]),/targetPaths/);
 assert.throws(()=>planOwnerDispatch([job('x',{repository:'other/private'})]),/repository/);
});
test('enforces bounded queue and capacities',()=>{
 assert.throws(()=>planOwnerDispatch(Array.from({length:65},(_,i)=>job('j'+i))),/64/);
 assert.throws(()=>planOwnerDispatch([], {directCapacity:100}),/directCapacity/);
});
test('bounded context keeps pinned inputs and verified receipts, not secrets or model approvals',()=>{
 const packet=buildWorkerContext(job('ctx'),{source:[{path:'README.md',commitSha:sha,excerpt:'verified',verified:true},{path:'bad',excerpt:'trust me',verified:false}],prior:[{event:'checks_passed',url:'https://github.com/www-infinity4/Moltnook/actions/runs/12',verified:true}],notes:'x'.repeat(10000)});
 assert.equal(packet.repository,'www-infinity4/Moltnook');
 assert.equal(packet.source.length,1);
 assert.equal(packet.notes.length<=1200,true);
 assert.equal(packet.writeAuthorized,false);
});
test('worker result cannot claim completion unless independently verified and bound to lease',()=>{
 const claim=job('a');
 assert.equal(checkWorkerResult(claim,{id:'a',leaseId:'lease-a',baseSha:sha,status:'completed'},false).status,'unverified');
 assert.equal(checkWorkerResult(claim,{id:'a',leaseId:'wrong',baseSha:sha,status:'tested'},true).status,'rejected');
 assert.equal(checkWorkerResult(claim,{id:'a',leaseId:'lease-a',baseSha:sha,status:'tested',commitSha:'b'.repeat(40)},true).status,'verified_source_result');
});
