import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchRunnerOidcIdentity} from './credential-bridge.mjs';

test('Moltnook executor uses the same bounded and signed identity routine as credential bridge',async()=>{
 const source=await readFile(new URL('./runner.mjs',import.meta.url),'utf8');
 assert.match(source,/import\s+\{fetchRunnerOidcIdentity\}\s+from '\.\/credential-bridge\.mjs'/);
 const call=source.slice(source.indexOf('async function call('),source.indexOf('async function event('));
 assert.match(call,/const value=await fetchRunnerOidcIdentity\(\)/);
 assert.doesNotMatch(call,/ACTIONS_ID_TOKEN_REQUEST_URL|ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
 assert.doesNotMatch(call,/Authorization:\s*'Bearer '\+process\.env/);
 assert.match(call,/fetch\(API\+'\/runner\/'\+step/);
 assert.equal(typeof fetchRunnerOidcIdentity,'function');
});

async function traceHarness(identity,request){

 const source=await readFile(
  new URL('./runner.mjs',import.meta.url),
  'utf8'
 );

 const start=source.indexOf(
  'async function call('
 );

 const end=source.indexOf(
  'async function event(',start
 );

 assert.ok(start>=0&&end>start);

 const report={};
 const logs=[];

 const call=new Function(
  'report',
  'fetchRunnerOidcIdentity',
  'fetch',
  'API',
  'lease',
  'budgetModelEvidence',
  'console',
  source.slice(start,end)+'\nreturn call;'
 )(
  report,
  identity,
  request,
  'https://brain.test',
  undefined,
  ()=>null,
  {error:(...args)=>logs.push(args)}
 );

 return {call,report,logs};

}

test('signed runner records failing operation without credentials',async()=>{

 const h=await traceHarness(
  async()=> 'synthetic-private-token',
  async()=>Response.json(
   {ok:false,error:'runner_operation_unavailable'},
   {status:503}
  )
 );

 await assert.rejects(
  h.call('claim'),
  /runner_operation_unavailable/
 );

 assert.ok(
  Array.isArray(h.report.runnerCallTrace),
  'missing runner call trace'
 );

 assert.equal(
  h.report.lastRunnerFailure.step,
  'claim'
 );

 assert.equal(
  h.report.lastRunnerFailure.httpStatus,
  503
 );

 assert.equal(
  h.report.lastRunnerFailure.phase,
  'remote'
 );

 assert.doesNotMatch(
  JSON.stringify([h.report,h.logs]),
  /synthetic-private-token/
 );

});

test('identity failure never reaches remote Brain',async()=>{

 let requests=0;

 const h=await traceHarness(
  async()=>{
   throw Error('identity unavailable');
  },
  async()=>{
   requests++;
   throw Error('must not execute');
  }
 );

 await assert.rejects(
  h.call('capability'),
  /identity unavailable/
 );

 assert.equal(requests,0);

 assert.equal(
  h.report.lastRunnerFailure.phase,
  'identity'
 );

});

test('transport failure retains original error and is not retried',async()=>{

 let requests=0;
 const original=Error('network unavailable');

 const h=await traceHarness(
  async()=> 'synthetic-token',
  async()=>{
   requests++;
   throw original;
  }
 );

 await assert.rejects(
  h.call('claim'),
  error=>error===original
 );

 assert.equal(requests,1);

 assert.equal(
  h.report.lastRunnerFailure.phase,
  'transport'
 );

});

test('invalid response is distinguished from authorization failure',async()=>{

 const h=await traceHarness(
  async()=> 'synthetic-token',
  async()=>new Response(
   'invalid json',
   {status:502}
  )
 );

 await assert.rejects(
  h.call('capability')
 );

 assert.equal(
  h.report.lastRunnerFailure.phase,
  'decode'
 );

 assert.equal(
  h.report.lastRunnerFailure.httpStatus,
  502
 );

});

test('successful calls preserve prior failure and bound trace storage',async()=>{

 let count=0;

 const h=await traceHarness(
  async()=> 'synthetic-token',
  async()=>{
   count++;

   if(count===1){
    return Response.json(
     {ok:false,error:'runner_operation_unavailable'},
     {status:503}
    );
   }

   return Response.json({ok:true});
  }
 );

 await assert.rejects(
  h.call('claim')
 );

 for(let i=0;i<40;i++){
  assert.deepEqual(
   await h.call('capability'),
   {ok:true}
  );
 }

 assert.equal(
  h.report.lastRunnerFailure.step,
  'claim'
 );

 assert.equal(
  h.report.runnerCallTrace.length,
  32
 );

 assert.equal(
  h.report.runnerCallTrace.at(-1).outcome,
  'success'
 );

});
