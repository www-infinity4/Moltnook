import test from 'node:test';
import assert from 'node:assert/strict';
import {forkLanguageUpstreams} from './fork-language-upstreams.mjs';
test('fork requests verify identity and parent; reruns read existing forks without mutations',async()=>{
 const created=new Set(),writes=[];
 const request=async(url,o)=>{
  assert.equal(o.redirect,'manual');
  if(url.endsWith('/user'))return Response.json({login:'www-infinity4'});
  const name=url.split('/').at(-1);
  if(o.method==='POST'){const source=url.split('/').at(-2);created.add(source);writes.push(url);return Response.json({},{status:202});}
  if(!created.has(name))return Response.json({},{status:404});
  return Response.json({full_name:'www-infinity4/'+name,fork:true,parent:{full_name:'astral-sh/'+name},default_branch:'main'});
 };
 const first=await forkLanguageUpstreams('fixture',{request,pause:async()=>{}});
 assert.equal(first.verified,true);assert.equal(writes.length,2);assert.equal(first.receipts[0].executionVerified,false);
 assert.equal((await forkLanguageUpstreams('fixture',{request})).verified,true);assert.equal(writes.length,2);
});
test('ambiguous fork submission is never retried; wrong parent is blocked',async()=>{
 let posts=0;
 const request=async(url,o)=>{if(url.endsWith('/user'))return Response.json({login:'www-infinity4'});if(o.method==='POST'){posts++;throw Error('lost response');}return Response.json({},{status:404});};
 const result=await forkLanguageUpstreams('fixture',{request});
 assert.equal(posts,2);assert.ok(result.receipts.every(r=>r.status==='unconfirmed'));assert.equal(result.verified,false);
 const blocked=await forkLanguageUpstreams('fixture',{request:async url=>url.endsWith('/user')?Response.json({login:'www-infinity4'}):Response.json({full_name:'www-infinity4/uv',fork:true,parent:{full_name:'other/uv'}})});
 assert.equal(blocked.verified,false);assert.ok(blocked.receipts.every(r=>r.status==='blocked'));
});
