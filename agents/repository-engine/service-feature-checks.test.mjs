import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyVideoRendererConfig,inspectServiceFeatureReport} from './service-feature-checks.mjs';

const unavailable={ok:true,configured:false,engines:[{id:'wan',ready:false},{id:'ltx',ready:false}]};
test('unconnected optional video provider is deferred, not a broken mobile page or verified video',()=>{
 const row=classifyVideoRendererConfig(true,unavailable);
 assert.equal(row.status,'deferred_external_renderer');
 assert.equal(row.videoVerified,false);
 assert.match(row.reason,/not connected/i);
});
test('ready ComfyUI or configured Imagine is reportable, not presumed usable without a render receipt',()=>{
 assert.equal(classifyVideoRendererConfig(true,{...unavailable,engines:[{id:'wan',ready:true}]}).status,'configured');
 assert.equal(classifyVideoRendererConfig(true,{...unavailable,configured:true}).status,'configured');
 assert.equal(classifyVideoRendererConfig(true,{...unavailable,configured:true}).videoVerified,false);
});
test('broken or invalid config remains a real failure',()=>{
 assert.equal(classifyVideoRendererConfig(false,unavailable).status,'failed');
 assert.equal(classifyVideoRendererConfig(true,{ok:false,engines:[]}).status,'failed');
 assert.equal(classifyVideoRendererConfig(true,{ok:true,engines:'not-an-array'}).status,'failed');
});
function fakeBrowser(config,ok=true){
 const page={goto:async()=>{},locator:()=>({waitFor:async()=>{},click:async()=>{},setInputFiles:async()=>{}}),waitForFunction:async()=>{}};
 return {newContext:async()=>({route:async()=>{},newPage:async()=>page,request:{get:async()=>({ok:()=>ok,json:async()=>config})},close:async()=>{}}),close:async()=>{}};
}
test('observer puts unconfigured renderer in a separate dependency ledger and preserves other page checks',async()=>{
 const report=await inspectServiceFeatureReport({launchBrowser:async()=>fakeBrowser(unavailable),writeReceipt:async()=>{}});
 assert.deepEqual(report.failures,[]);
 assert.equal(report.deferred.length,1);
 assert.equal(report.deferred[0].selector,'#phiVideoBuilder');
 assert.equal(report.records.find(r=>r.name==='Moving video').status,'deferred_external_renderer');
 assert.equal(report.records.find(r=>r.name==='Code Phi image upload').uploadPreviewVerified,true);
});
test('actual video config API failure remains in failure ledger',async()=>{
 const report=await inspectServiceFeatureReport({launchBrowser:async()=>fakeBrowser(unavailable,false),writeReceipt:async()=>{}});
 assert.equal(report.failures.length,1);
 assert.deepEqual(report.deferred,[]);
 assert.equal(report.failures[0].selector,'#phiVideoBuilder');
});
