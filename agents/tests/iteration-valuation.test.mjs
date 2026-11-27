import test from 'node:test';
import assert from 'node:assert/strict';
import {recordIterationValuation} from '../repository-engine/iteration-valuation.mjs';

const run=id=>`https://github.com/www-infinity4/Moltnook/actions/runs/${id}`;
const sha='a'.repeat(40);
const checked=(id='MN-002')=>({id,repo:'Moltnook',head:{sha},checks:[
  {path:'README.md',found:true,sha:'b'.repeat(40),url:`https://github.com/www-infinity4/Moltnook/blob/${sha}/README.md`},
  {path:'missing.txt',found:false,sha:null,error:'404',url:`https://github.com/www-infinity4/Moltnook/blob/${sha}/missing.txt`}
]});

test('logs real verified reads and failed attempts, with no invented monetary rewards',()=>{
  const result=recordIterationValuation(null,[checked()],{runUrl:run(100),generatedAt:'2026-11-22T12:00:00.000Z'});
  assert.equal(result.total_completed_iterations,1);
  assert.equal(result.cumulative_system_value,1);
  assert.equal(result.by_repository.Moltnook.attempted_iterations,2);
  assert.equal(result.by_repository.Moltnook.failed_iterations,1);
  assert.equal(result.recent_transitions.length,2);
  assert.equal(result.recent_transitions[0].iteration_weight_type,'STANDARD');
  assert.equal(result.recent_transitions[0].system_credit_value,1);
  assert.equal(result.recent_transitions[1].system_credit_value,0);
  assert.equal(result.recent_transitions[0].style_compliance,'not_evaluated');
  assert.equal(result.unit,'internal_non_monetary_inspection_points');
  assert.equal(result.recent_transitions[0].website_scope_identifier,null);
});

test('retry of same run or older run cannot double tally',()=>{
 const a=recordIterationValuation(null,[checked()],{runUrl:run(100),generatedAt:'2026-11-22T12:00:00.000Z'});
 const b=recordIterationValuation(a,[checked()],{runUrl:run(100),generatedAt:'2026-11-22T12:01:00.000Z'});
 const c=recordIterationValuation(b,[checked()],{runUrl:run(99),generatedAt:'2026-11-22T12:02:00.000Z'});
 assert.deepEqual(c,a);
 const d=recordIterationValuation(c,[checked()],{runUrl:run(101),generatedAt:'2026-11-22T12:03:00.000Z'});
 assert.equal(d.total_completed_iterations,2);
 assert.equal(d.by_repository.Moltnook.attempted_iterations,4);
});

test('missing run receipt or unverified blob SHA cannot earn a credit',()=>{
 const noRun=recordIterationValuation(null,[checked()],{runUrl:null,generatedAt:'2026-11-22T12:00:00.000Z'});
 assert.equal(noRun.total_completed_iterations,0);
 const bad=checked(); bad.checks[0].sha=null;
 const result=recordIterationValuation(noRun,[bad],{runUrl:run(102),generatedAt:'2026-11-22T12:00:00.000Z'});
 assert.equal(result.cumulative_system_value,0);
 assert.equal(result.by_repository.Moltnook.failed_iterations,2);
});

test('keep aggregates as recent detailed transitions rotate out',()=>{
 let ledger=null;
 for(let i=100;i<190;i++) ledger=recordIterationValuation(ledger,[checked()],{runUrl:run(i),generatedAt:'2026-11-22T12:00:00.000Z'});
 assert.equal(ledger.total_completed_iterations,90);
 assert.equal(ledger.by_repository.Moltnook.attempted_iterations,180);
 assert.ok(ledger.recent_transitions.length<=100);
});
