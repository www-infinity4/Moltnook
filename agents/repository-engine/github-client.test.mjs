import test from 'node:test';
import assert from 'node:assert/strict';
import {createGithubClient} from './github-client.mjs';
const response=(status,body,headers={})=>({
 ok:status>=200&&status<300,status,
 headers:{get:k=>Object.entries(headers).find(([name])=>name.toLowerCase()===k.toLowerCase())?.[1]??null},
 json:async()=>body
});
test('GET rate limit retries using Retry-After without exposing credentials',async()=>{
 const calls=[],sleeps=[],replies=[response(429,{message:'rate limit'},{'retry-after':'2'}),response(200,{id:123})];
 const client=createGithubClient({token:'secret',sleep:async ms=>sleeps.push(ms),fetchImpl:async(url,opts)=>{calls.push({url,opts});return replies.shift()}});
 assert.deepEqual(await client('repos/www-infinity4/QuantaPhi'),{id:123});
 assert.deepEqual(sleeps,[2000]);assert.equal(calls.length,2);
 assert.equal(calls[0].opts.headers.Authorization,'Bearer secret');
});
test('403 rate limit honors reset; normal 403 permission failure never retries',async()=>{
 const sleeps=[];let calls=0;
 const client=createGithubClient({token:'secret',now:()=>1000000,sleep:async ms=>sleeps.push(ms),
  fetchImpl:async()=>++calls===1?response(403,{},{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1003'}):response(200,{ok:true})});
 assert.deepEqual(await client('repos/www-infinity4/Moltnook'),{ok:true});
 assert.deepEqual(sleeps,[3000]);
 const forbidden=createGithubClient({token:'secret',sleep:async()=>assert.fail('unexpected retry'),fetchImpl:async()=>response(403,{message:'denied'})});
 await assert.rejects(forbidden('repos/www-infinity4/Moltnook'),/github_http_403/);
});
test('state-changing API calls never retry a failed or unconfirmed write',async()=>{
 let attempts=0;
 const client=createGithubClient({token:'secret',sleep:async()=>assert.fail('unexpected write retry'),
  fetchImpl:async()=>{attempts++;return response(503,{message:'server failed'})}});
 await assert.rejects(client('repos/www-infinity4/QuantaPhi/pulls',{method:'POST',body:{title:'review'}}),/github_write_unconfirmed_http_503/);
 assert.equal(attempts,1);
 const broken=createGithubClient({token:'secret',fetchImpl:async()=>{throw Error('secret network problem')}});
 await assert.rejects(broken('repos/www-infinity4/QuantaPhi/git/refs',{method:'POST',body:{ref:'refs/heads/test'}}),/github_write_unconfirmed_network/);
});
test('GET 503 uses bounded retries and eventually exposes failure not fake success',async()=>{
 let calls=0;
 const client=createGithubClient({token:'hidden',sleep:async()=>{},maxRetries:2,fetchImpl:async()=>{calls++;return response(503,{message:'hidden'})}});
 await assert.rejects(client('repos/www-infinity4/QuantaPhi'),/github_http_503/);
 assert.equal(calls,3);
});
test('ETags are revalidated only for metadata and a 304 needs a real cache',async()=>{
 let n=0;const headers=[];
 const client=createGithubClient({token:'secret',fetchImpl:async(_u,o)=>{headers.push(o.headers);return ++n===1?response(200,{name:'Moltnook'},{etag:'"abc"'}):response(304,null)}});
 assert.deepEqual(await client('repos/www-infinity4/Moltnook'),{name:'Moltnook'});
 assert.deepEqual(await client('repos/www-infinity4/Moltnook'),{name:'Moltnook'});
 assert.equal(headers[1]['If-None-Match'],'"abc"');
 const orphan=createGithubClient({token:'secret',fetchImpl:async()=>response(304,null)});
 await assert.rejects(orphan('repos/www-infinity4/Moltnook'),/github_cache_miss_304/);
});
test('mutable refs and pull mergeability are never cached',async()=>{
 const headers=[];let calls=0;
 const client=createGithubClient({token:'secret',fetchImpl:async(_u,o)=>{headers.push(o.headers);return response(200,{sha:String(++calls)},{etag:'"abc"'})}});
 await client('repos/www-infinity4/Moltnook/git/ref/heads/main');
 await client('repos/www-infinity4/Moltnook/git/ref/heads/main');
 await client('repos/www-infinity4/Moltnook/pulls/236');
 await client('repos/www-infinity4/Moltnook/pulls/236');
 assert.equal(headers.every(x=>!x['If-None-Match']),true);
});
test('unsafe route, over-budget retry and sensitive upstream error bodies fail closed',async()=>{
 const client=createGithubClient({token:'secret',fetchImpl:async()=>response(401,{message:'secret'})});
 await assert.rejects(client('https://example.com/evil'),/github_resource_invalid/);
 await assert.rejects(client('repos/www-infinity4/..%2fprivate'),/github_resource_invalid/);
 await assert.rejects(client('repos/www-infinity4/QuantaPhi'),error=>!/secret/.test(String(error))&&/github_http_401/.test(String(error)));
 const limited=createGithubClient({token:'secret',sleep:async()=>assert.fail('no long sleep'),fetchImpl:async()=>response(429,{},{'retry-after':'100'})});
 await assert.rejects(limited('repos/www-infinity4/Moltnook'),/github_rate_limit_deferred/);
 const noHeader=createGithubClient({token:'secret',sleep:async()=>{throw Error('should defer unknown limit')},fetchImpl:async()=>response(429,{})});
 await assert.rejects(noHeader('repos/www-infinity4/Moltnook'),/github_rate_limit_deferred/);
});
