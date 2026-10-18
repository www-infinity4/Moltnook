import test from 'node:test';
import assert from 'node:assert/strict';
import {
 checkPreviewPatchPreflight,buildPatch,assertUpdatedPreview,
 PRODUCTION_DEPLOYMENT,PRODUCTION_VERSION,CANDIDATE_VERSION,SOURCE_SHA,
 PREVIEW_ID,PREVIEW_SLUG
} from './brain-preview-update.mjs';
const clock={name:'CLOCK',type:'durable_object_namespace',namespace_id:'a'.repeat(32)};
const production=[clock,{name:'WORK_DB',type:'d1',database_id:'4aa6a463-02c6-48c3-854f-a87c0ca5f41c'},
 {name:'WRITER_OWNER_HASH',type:'plain_text',text:'private-identity-do-not-emit'},
 {name:'BOT_WORK_SECRET',type:'secret_text'}, {name:'BOT_WALLET',type:'service'},
 {name:'MODELS',type:'service'},{name:'WRITER_AI',type:'ai'}];
const active={deployments:[{id:PRODUCTION_DEPLOYMENT,versions:[
 {version_id:PRODUCTION_VERSION,percentage:100}]}]};
const productionVersion={resources:{bindings:production}};
const stagedVersion={id:CANDIDATE_VERSION,resources:{bindings:[...production]},annotations:{
 'workers/message':'Verified Brain source from QuantaPhi commit '+SOURCE_SHA
}};
const previews=[{id:PREVIEW_ID,slug:PREVIEW_SLUG}];
const env={BRAIN_CANARY_MODE:{type:'plain_text',text:'isolated'},
 CLOCK:{type:'durable_object_namespace',class_name:'BrainClock',namespace_id:'b'.repeat(32)},
 WORK_DB:{type:'d1',database_id:'76deaa98-5d3a-4151-8390-e14d7da87cb3'}};
const original={items:[{id:'a'.repeat(8)+'-aaaa-aaaa-aaaa-'+'a'.repeat(12),
 main_module:'brain-isolated-probe.js',env,annotations:{'workers/tag':'26518e9'}}]};
const subdomain={enabled:true,previews_enabled:false};
const args={production:active,productionVersion,stagedVersion,previews,
 deployments:original,subdomain};
test('preview gate requires one existing isolated Preview, no public URLs, matching production SHA/DO/D1',()=>{
 const receipt=checkPreviewPatchPreflight(args);
 assert.equal(receipt.previewId,PREVIEW_ID);
 assert.equal(receipt.expectedProductionId,PRODUCTION_DEPLOYMENT);
 assert.ok(!JSON.stringify(receipt).includes('private-identity'));
 for(const [key,value] of [
  ['production',{deployments:[]}],
  ['production',{deployments:[{id:PRODUCTION_DEPLOYMENT,versions:[{version_id:PRODUCTION_VERSION,percentage:99}]}]}],
  ['stagedVersion',{...stagedVersion,id:PRODUCTION_VERSION}],
  ['subdomain',{enabled:true,previews_enabled:true}],
  ['previews',[...previews,{id:'new',slug:'evil'}]],
  ['deployments',{items:[{...original.items[0],env:{...env,BOT_WALLET:{type:'service'}}}]}]
 ]){
  assert.throws(()=>checkPreviewPatchPreflight({...args,[key]:value}),/preview|source|staged|production/);
 }
 assert.throws(()=>checkPreviewPatchPreflight({...args,deployments:{items:[{
  ...original.items[0],env:{...env,CLOCK:{...env.CLOCK,namespace_id:'a'.repeat(32)}}
 }]}}),/preview/);
});
test('only synthetic pinned read-only preview module may be updated; never send owner credentials or resources',()=>{
 const sample=('export default {fetch(){return new Response("'+
 '__preview__/admission mergedSourceRecognized ownerBlockPreserved source_review_only'+'")}};\n').repeat(8);
 const patch=buildPatch({js:sample});
 assert.deepEqual(Object.keys(patch).sort(),['annotations','modules']);
 assert.deepEqual(Object.keys(patch.modules[0]).sort(),['content_base64','content_type','name']);
 assert.equal(patch.annotations['workers/commit_sha'],SOURCE_SHA);
 assert.equal(patch.modules[0].name,'brain-isolated-probe.js');
 assert.ok(!JSON.stringify(patch).includes('WRITER_OWNER_HASH'));
 assert.throws(()=>buildPatch({js:'console.log("hello")'}),/synthetic_pink/);
 assert.throws(()=>buildPatch({js:sample,sourceSha:'b'.repeat(40)}),/synthetic_pink/);
});
test('no source-success receipt when preview bindings or production traffic change',()=>{
 const latest={items:[{...original.items[0],id:'b'.repeat(8)+'-bbbb-bbbb-bbbb-'+'b'.repeat(12),
 annotations:{'workers/tag':SOURCE_SHA.slice(0,7),'workers/commit_sha':SOURCE_SHA}}]};
 const receipt=assertUpdatedPreview({before:original,after:latest,
  productionBefore:active,productionAfter:structuredClone(active)});
 assert.equal(receipt.noProductionTrafficChanged,true);
 assert.equal(receipt.isolatedBindingsUnchanged,true);
 assert.ok(!JSON.stringify(receipt).includes('private-identity'));
 assert.throws(()=>assertUpdatedPreview({before:original,after:latest,
  productionBefore:active,productionAfter:{deployments:[]}}),/production_changed/);
 const changed={items:[{...latest.items[0],env:{...env,WRITER_OWNER_HASH:{type:'plain_text',text:'bad'}}}]};
 assert.throws(()=>assertUpdatedPreview({before:original,after:changed,
  productionBefore:active,productionAfter:active}),/bindings_changed/);
 const missing={items:[{...latest.items[0],annotations:{}}]};
 assert.throws(()=>assertUpdatedPreview({before:original,after:missing,
  productionBefore:active,productionAfter:active}),/source_missing/);
});
