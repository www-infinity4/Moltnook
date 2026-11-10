import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchReadJobs} from './parallel-read-dispatch.mjs';
test('bounded workers execute concurrently and preserve input order',async()=>{
 let active=0,peak=0;
 const jobs=Array.from({length:8},(_,i)=>({id:'task-'+i,role:i%2?'yellow':'blue'}));
 const handler=async job=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return {verified:true,source:'repo:'+job.id};};
 const result=await dispatchReadJobs(jobs,{blue:handler,yellow:handler},{concurrency:3});
 assert.equal(peak,3);assert.deepEqual(result.results.map(x=>x.id),jobs.map(x=>x.id));
 assert.equal(result.verified,8);assert.equal(result.writeAuthorized,false);
});
test('missing source receipt is unverified',async()=>{
 const result=await dispatchReadJobs([{id:'a',role:'blue'}],{blue:async()=>({verified:true})});
 assert.equal(result.results[0].status,'unverified');
});
test('failure is isolated and successful work is retained',async()=>{
 const result=await dispatchReadJobs([{id:'a',role:'blue'},{id:'b',role:'yellow'}],{blue:async()=>{throw Error('offline');},yellow:async()=>({verified:true,source:'github:sha'})});
 assert.deepEqual(result.results.map(x=>x.status),['failed','verified']);
});
test('rejects duplicate IDs and excess concurrency',async()=>{
 await assert.rejects(dispatchReadJobs([{id:'a',role:'blue'},{id:'a',role:'blue'}],{}));
 await assert.rejects(dispatchReadJobs([],{},{concurrency:99}));
});