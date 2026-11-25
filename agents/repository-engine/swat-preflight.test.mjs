import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSwatRuntime } from './swat-preflight.mjs';
const versions={python:'3.10.14',torch:'2.6.0+cu124',transformers:'5.2.0',cudaDevices:2};
const all=()=>true;
test('missing Python or artifacts stays blocked without claiming execution',()=>{
 const r=inspectSwatRuntime({probe:()=>{throw Error('private path');},file:()=>false});
 assert.equal(r.status,'blocked');assert.equal(r.cacheTransferVerified,false);assert.equal(r.textFallback,true);
 assert.ok(!JSON.stringify(r).includes('private path'));
});
test('upstream training prerequisites are distinguished from actual cache transfer',()=>{
 const r=inspectSwatRuntime({probe:()=>versions,file:all,sender:'/a',receiver:'/b',mapper:'/c'});
 assert.equal(r.status,'prerequisites_observed');assert.equal(r.trainingGpuCountMet,true);assert.equal(r.cacheTransferVerified,false);assert.equal(r.modelInvocationPerformed,false);
});
test('CPU and unpinned software remain blocked',()=>{
 const r=inspectSwatRuntime({probe:()=>({...versions,cudaDevices:0,torch:'2.5.0'}),file:all,sender:'/a',receiver:'/b',mapper:'/c'});
 assert.equal(r.status,'blocked');assert.equal(r.trainingGpuCountMet,false);assert.equal(r.softwareMatches,false);
});
test('one GPU is not enough for the upstream two-GPU training recipe',()=>{
 const r=inspectSwatRuntime({probe:()=>({...versions,cudaDevices:1}),file:all,sender:'/a',receiver:'/b',mapper:'/c'});
 assert.equal(r.status,'blocked');assert.equal(r.trainingGpuCountMet,false);
});
