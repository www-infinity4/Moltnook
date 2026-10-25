import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceWindows,visibleEditAnchors,checkVisibleEdits,sha256} from './context-windows.mjs';
import {applyEdits} from './patch.mjs';
const path='workers/infinity-brain-clock/technical-handoff.mjs';
const source="export function attachTechnicalHandoff(context,sourceJob,receipt){\n const instruction='repair the actual failure';\n jobs.push({id,repository:sourceJob.repository,instructions:instruction});\n return {queued:true};\n}\n";
test('short exact insertion anchors pass existing visible/full-source gates without fuzzy matching',()=>{
 const original={[path]:source},packet=sourceWindows(original,{task:'attachTechnicalHandoff instruction jobs'});
 const manifest=visibleEditAnchors(original,packet,{task:'attachTechnicalHandoff instruction jobs'});
 assert.equal(manifest[path].sourceSha256,sha256(source));assert.ok(manifest[path].anchors.length>0);
 for(const anchor of manifest[path].anchors){
  assert.equal(anchor.sha256,sha256(anchor.before));assert.ok(anchor.before.length<=240);
  const edits=[{path,before:anchor.before,after:'// bounded insertion\n'+anchor.before}];
  assert.equal(checkVisibleEdits(packet,edits),true);
  assert.ok(applyEdits(original,edits)[path].includes('// bounded insertion\n'+anchor.before));
 }
 const invented=[{path,before:"const instruction = 'a model-retyped literal';",after:'replacement'}];
 assert.equal(checkVisibleEdits(packet,invented),false);
});
test('anchors never expose hidden source or accept stale/tampered window metadata',()=>{
 const original={[path]:source},packet=sourceWindows(original,{task:'attachTechnicalHandoff'});
 const partial=structuredClone(packet),text=source.split('\n')[0];
 partial.source[path].windows=[{start:0,end:text.length,text,sha256:sha256(text)}];
 const anchors=visibleEditAnchors(original,partial);
 assert.ok(anchors[path].anchors.every(a=>text.includes(a.before)));
 const tampered=structuredClone(partial);tampered.source[path].windows[0].text+='hidden';
 assert.deepEqual(visibleEditAnchors(original,tampered),{});
 assert.deepEqual(visibleEditAnchors({[path]:source+'changed'},packet),{});
});
test('non-unique anchors and new files do not receive fabricated source literals',()=>{
 const duplicated=" const instruction='same';\n const instruction='same';\n";
 const original={[path]:duplicated,'new.mjs':null};
 const packet=sourceWindows(original);
 assert.deepEqual(visibleEditAnchors(original,packet),{});
});
test('real runner supplies copy anchors to Green and still applies all exact/review/test gates',()=>{
 const runner=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
 assert.match(runner,/exactCopyAnchors:useWindowV2\?visibleEditAnchors\(original,windowEvidence/);
 assert.match(runner,/!checkVisibleEdits\(windowEvidence,proposal.edits\)/);
 assert.match(runner,/applyEdits\(original,proposal.edits\)/);
 assert.match(runner,/await call\('engine-review'/);
 assert.match(runner,/await checks\(candidate.patched\)/);
});

test('a long instruction line is never offered as a cut-off expression prefix',()=>{
 const full="export function repair(){\n const instruction='"+'x'.repeat(400)+"';\n return {queued:true};\n}\n";
 const original={[path]:full},packet=sourceWindows(original);
 const result=visibleEditAnchors(original,packet);
 for(const anchor of result[path].anchors)assert.ok(full.split('\n').includes(anchor.before));
 assert.ok(result[path].anchors.every(a=>!a.before.includes('const instruction=')));
});
