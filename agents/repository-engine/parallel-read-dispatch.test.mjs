import {inspectPinnedPaths} from './pinned-read-inspection.mjs';
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

test('actual inspection handoff pins every GitHub source read to the claimed SHA',async()=>{
 const head='a'.repeat(40),reads=[];
 const rows=await inspectPinnedPaths({
  paths:['README.md','src/app.mjs'],commitSha:head,
  read:async(path,sha)=>{reads.push({path,sha});return {ok:true,sha:'b'.repeat(40)};},
  sourceUrl:(path,sha)=>'https://github.com/example/repo/blob/'+sha+'/'+path,
  concurrency:2
 });
 assert.equal(reads.length,2);
 assert.ok(reads.every(r=>r.sha===head));
 assert.ok(rows.every(r=>r.found&&r.sha==='b'.repeat(40)&&r.url.includes(head)));
});

test('missing pinned file is not verified and cannot turn read-only into a writer',async()=>{
 const rows=await inspectPinnedPaths({
  paths:['README.md','missing.mjs'],commitSha:'a'.repeat(40),
  read:async path=>path==='README.md'?{ok:true,sha:'b'.repeat(40)}:{ok:false,error:'github_http_404'},
  sourceUrl:(path,sha)=>'https://github.com/example/repo/blob/'+sha+'/'+path
 });
 assert.equal(rows[0].found,true);
 assert.equal(rows[1].found,false);
 assert.equal(rows[1].error,'github_http_404');
 await assert.rejects(inspectPinnedPaths({paths:['../secrets'],commitSha:'a'.repeat(40),read:async()=>({ok:true,sha:'b'.repeat(40)}),sourceUrl:()=>''}));
});
