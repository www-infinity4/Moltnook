import test from 'node:test';
import assert from 'node:assert/strict';
import {COLOR_GPT_MODEL,colorProfile,phaseColorCore,invokeColorCore} from './color-core.mjs';
test('all colors share one actual GPT gateway model; appendages never grant privileges',()=>{
 const spectrum={red:['red'],yellow:['yellow'],blue:['blue'],orange:['red','yellow'],
  purple:['purple','blue','red'],green:['green','yellow','blue','pink','red','white'],
  pink:['pink'],white:['white'],black:['black','pink','white']};
 for(const [color,layers]of Object.entries(spectrum)){
  const p=colorProfile(color);
  assert.equal(p.model,COLOR_GPT_MODEL);assert.equal(p.core,'shared-gpt');
  assert.deepEqual(p.layers,layers);assert.equal(p.toolAccess,'request-only');
  assert.equal(p.credentialAccess,'none');assert.equal(p.ownerApproval,'not-overridable');
 }
 assert.ok(colorProfile('yellow').appendages.includes('data-extraction'));
 assert.ok(colorProfile('green').appendages.includes('sandbox-tests'));
 assert.throws(()=>colorProfile('unknown'),/unknown_role/);
 assert.equal(phaseColorCore('build').gptCore,COLOR_GPT_MODEL);
 assert.ok(phaseColorCore('arbitrate').layers.includes('red'));
});
test('color model invocation requires a live authenticated callback and an exact read-only inference receipt',async()=>{
 let requested;
 const invoke=async(step,payload)=>{requested={step,payload};return {
  ok:true,status:'model_inference_completed',model:COLOR_GPT_MODEL,color:payload.color,layers:colorProfile(payload.color).layers,
  toolRequestsAreNotExecution:true,authorizedOperationsPerformed:false,
  finding:'A cited source was found',nextAction:'Validate source',blockers:[],toolRequests:['data-extraction']
 };};
 const result=await invokeColorCore(invoke,{color:'yellow',task:'Extract citations',evidence:{source:'pinned'}});
 assert.equal(requested.step,'color-think');assert.equal(requested.payload.task,'Extract citations');
 assert.equal(result.status,'model_inference_completed');assert.equal(result.anyToolsExecuted,false);
 assert.equal(result.sourceCommitted,false);assert.equal(result.walletChanged,false);
 assert.deepEqual(result.requestedAppendages,['data-extraction']);
 await assert.rejects(invokeColorCore(null,{color:'yellow',task:'x'}),/authenticated_runner/);
 await assert.rejects(invokeColorCore(async()=>({...await invoke('color-think',{color:'yellow'}),toolRequests:['mint-tokens']}),{color:'yellow',task:'x'}),/unlisted_appendage/);
 await assert.rejects(invokeColorCore(async()=>({...await invoke('color-think',{color:'yellow'}),authorizedOperationsPerformed:true}),{color:'yellow',task:'x'}),/receipt_unverified/);
 await assert.rejects(invokeColorCore(async()=>({...await invoke('color-think',{color:'yellow'}),model:'fake-model'}),{color:'yellow',task:'x'}),/receipt_unverified/);
});
