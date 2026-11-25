import test from 'node:test';
import assert from 'node:assert/strict';
import { packContext, receiveContext } from './native-context.mjs';
const scope={jobId:'issue:owner/repo#1',repo:'owner/repo',baseSha:'a'.repeat(40)};
const text='Source evidence: ∆ — '.repeat(100);
test('lossless ordered handoff with repeat references and measurable wire savings',()=>{
 const cache=new Map(); const first=packContext(scope,[text,text,'next']);
 assert.deepEqual(receiveContext(scope,first,cache),[text,text,'next']);
 const second=packContext(scope,[text,'next'],[...cache.keys()]);
 assert.ok(JSON.stringify(second).length<JSON.stringify(packContext(scope,[text,'next'])).length);
 assert.deepEqual(receiveContext(scope,second,cache),[text,'next']);
});
test('missing references fail closed and a full resend recovers',()=>{
 const cache=new Map();const full=packContext(scope,[text]); receiveContext(scope,full,cache);
 const ref=packContext(scope,[text],[...cache.keys()]);
 assert.throws(()=>receiveContext(scope,ref,new Map()),/missing/);
 assert.deepEqual(receiveContext(scope,full,new Map()),[text]);
});
test('tampering, cross-job reuse and malformed scopes are rejected atomically',()=>{
 const packet=packContext(scope,['one','two']);const cache=new Map();packet.entries[1].text='bad';
 assert.throws(()=>receiveContext(scope,packet,cache),/integrity/);assert.equal(cache.size,0);
 assert.throws(()=>receiveContext({...scope,jobId:'other'},packContext(scope,['one']),cache),/scope/);
 assert.throws(()=>packContext({...scope,baseSha:'main'},['one']),/scope/);
});
test('payload and expanded size limits apply to repeated references',()=>{
 assert.throws(()=>packContext(scope,Array(65).fill('x')),/limit/);
 assert.throws(()=>packContext(scope,['x'.repeat(32769)]),/limit/);
 assert.throws(()=>packContext(scope,Array(5).fill('x'.repeat(30000))),/limit/);
});
test('corrupted receiver cache and unexpected packet fields are rejected',()=>{
 const cache=new Map();const full=packContext(scope,['one']);receiveContext(scope,full,cache);
 const ref=packContext(scope,['one'],[...cache.keys()]);cache.set(ref.entries[0].id,'bad');
 assert.throws(()=>receiveContext(scope,ref,cache),/integrity/);
 assert.throws(()=>receiveContext(scope,{...full,authorized:true},new Map()),/invalid/);
});
