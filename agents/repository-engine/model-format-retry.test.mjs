import test from 'node:test';
import assert from 'node:assert/strict';
import {retryStructuredModelCall} from './model-format-retry.mjs';
test('format failures retry and recover without inventing model output',async()=>{
 let n=0;const out=await retryStructuredModelCall(async()=>{
  n++;if(n<3)throw new SyntaxError('Expected double-quoted property name in JSON at position 217');return {files:['index.html'],blockers:[]};
 });assert.equal(n,3);assert.deepEqual(out.blockers,[]);
});
test('authentication and permission blockers are not retried',async()=>{
 let n=0;await assert.rejects(retryStructuredModelCall(async()=>{n++;throw Error('writer_lease_rejected') }),/writer_lease_rejected/);assert.equal(n,1);
});
test('format failures stop after three attempts',async()=>{
 let n=0;await assert.rejects(retryStructuredModelCall(async()=>{n++;throw new SyntaxError('Expected double-quoted property name in JSON') }),/Expected double/);assert.equal(n,3);
});
