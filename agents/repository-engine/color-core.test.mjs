import test from 'node:test';
import assert from 'node:assert/strict';
import {COLOR_GPT_MODEL,colorProfile,phaseColorCore,invokeColorCore,composeWhiteEvidence,assimilatePinkEvidence} from './color-core.mjs';
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


test('Orange and Blue advisory tool labels match the signed Brain without granting any tool execution',async()=>{
 const cases={
  orange:['architecture-decision'],
  blue:['source-adapter','data-normalization','provenance-record']
 };
 for(const [color,requests] of Object.entries(cases)){
  const profile=colorProfile(color);
  for(const request of requests){
   assert.ok(profile.appendages.includes(request),color+': '+request);
   const thought=await invokeColorCore(async(_step,payload)=>({
    ok:true,status:'model_inference_completed',model:COLOR_GPT_MODEL,
    color:payload.color,layers:profile.layers,toolRequestsAreNotExecution:true,
    authorizedOperationsPerformed:false,finding:'Advisory evidence',
    nextAction:'Use the permitted scoped adapter',blockers:[],toolRequests:[request]
   }),{color,task:'Evaluate a scoped owner request'});
   assert.deepEqual(thought.requestedAppendages,[request]);
   assert.equal(thought.anyToolsExecuted,false);
   assert.equal(thought.sourceCommitted,false);
   assert.equal(thought.productionDeployed,false);
   assert.equal(thought.walletChanged,false);
  }
 }
 assert.equal(colorProfile('orange').credentialAccess,'none');
 assert.equal(colorProfile('blue').ownerApproval,'not-overridable');
});


test('White composes bounded multi-color sources without elevating claims to approvals',()=>{
 const red={sourceId:'red:coin',sourceUrl:'https://example.org/coin',color:'red',note:'Indexed coin listing'};
 const yellow={sourceId:'yellow:views',sourceUrl:'https://example.org/analytics',color:'yellow',note:'Reported view count'};
 const blue={sourceId:'blue:schema',sourceUrl:'https://example.org/schema',color:'blue',note:'Import shape reviewed'};
 const compiled=composeWhiteEvidence([red,yellow,blue,red]);
 assert.equal(compiled.role,'white');
 assert.equal(compiled.status,'source_collation_only');
 assert.equal(compiled.sources.length,3);
 assert.equal(compiled.duplicateCount,1);
 assert.deepEqual(compiled.colors,['red','yellow','blue']);
 assert.deepEqual(compiled.conflicts,[]);
 assert.equal(compiled.conclusion,null);
 assert.equal(compiled.authorizedOperationsPerformed,false);
 assert.equal(compiled.anyToolsExecuted,false);
 assert.equal(compiled.mergeAuthorized,false);
 assert.equal(compiled.walletChanged,false);
 assert.deepEqual(compiled.sources[0],red);
 assert.ok(colorProfile('white').appendages.includes('repository-map'));
 assert.ok(colorProfile('white').appendages.includes('source-adapter'));
});
test('White preserves duplicate-ID source disagreements as conflicts rather than silently choosing a fact',()=>{
 const base={sourceId:'red:coin',sourceUrl:'https://example.org/coin',color:'red',note:'Listed'};
 const compiled=composeWhiteEvidence([base,{...base,note:'Not listed'}]);
 assert.equal(compiled.sources.length,1);
 assert.deepEqual(compiled.conflicts,[{sourceId:'red:coin',reason:'conflicting_source_records'}]);
 assert.equal(compiled.conclusion,null);
});
test('Pink blends indexed Red evidence with Pink review evidence without inheriting execution authority',()=>{
 const red={sourceId:'red:coin',sourceUrl:'https://example.org/coin',color:'red',note:'Coin index record'};
 const review={sourceId:'pink:test',sourceUrl:'https://example.org/test',color:'pink',note:'Review notes for that source'};
 const blended=assimilatePinkEvidence([red],[review]);
 assert.equal(blended.role,'pink');
 assert.equal(blended.status,'review_candidate_not_approved');
 assert.deepEqual(blended.redSources,[red]);
 assert.deepEqual(blended.reviewSources,[review]);
 assert.equal(blended.conclusion,null);
 assert.equal(blended.anyToolsExecuted,false);
 assert.equal(blended.mergeAuthorized,false);
 assert.ok(colorProfile('pink').appendages.includes('provenance-record'));
 assert.ok(colorProfile('pink').appendages.includes('data-normalization'));
});
test('White and Pink reject unsafe provenance, missing source sectors, and excessive fanout',()=>{
 const red={sourceId:'red:coin',sourceUrl:'https://example.org/coin',color:'red',note:'Listed'};
 assert.throws(()=>composeWhiteEvidence([{...red,sourceUrl:'javascript:alert(1)'}]),/source_invalid/);
 assert.throws(()=>composeWhiteEvidence([{...red,sourceUrl:'https://user:pass@example.org/coin'}]),/source_invalid/);
 assert.throws(()=>composeWhiteEvidence([{...red,note:'x'.repeat(1000)}]),/source_invalid/);
 assert.throws(()=>composeWhiteEvidence(Array(65).fill(red)),/source_limit/);
 assert.throws(()=>assimilatePinkEvidence([],[{...red,color:'pink'}]),/requires_red/);
 assert.throws(()=>assimilatePinkEvidence([red],[red]),/requires_pink/);
});
