import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceWindows,checkVisibleEdits} from './context-windows.mjs';
import {applyEdits} from './patch.mjs';
import {repairWithFeedback} from './repair-feedback.mjs';
import {sourceDraftRetry,retainSourceExactDrafts as retain,mergeSourceDrafts as merge} from './source-drafts.mjs';
const original={'source.mjs':'export const mode=1;\n','test.mjs':'const existingTest=true;\n'};
const packet=sourceWindows(original);
const good={path:'source.mjs',before:'export const mode=1;',after:'export const mode=2;'};
const bad={path:'test.mjs',before:'',after:'const newTest=true;'};
test('actual retry loop retains only exact-source unapplied edits and still reviews/tests complete patch',async()=>{
 let drafts=[],last=[],builds=0,applied=false;
 const result=await repairWithFeedback({build:async()=>{
  builds++;assert.equal(applied,false);
  const response=builds===1?[good,bad]:[{path:'test.mjs',before:'const existingTest=true;',after:'const existingTest=true;\nconst newTest=true;'}];
  last=merge(drafts,response);
  if(!checkVisibleEdits(packet,last))throw Error('Model attempted an edit outside the pinned source windows');
  return applyEdits(original,last);
 },restore:async()=>{},onFeedback:async f=>{drafts=sourceDraftRetry(f)?retain(original,packet,last):[];},
 review:async candidate=>{assert.match(candidate['source.mjs'],/mode=2/);assert.match(candidate['test.mjs'],/newTest=true/);return {approved:true};},
 test:async candidate=>({passed:candidate['source.mjs'].includes('mode=2')&&candidate['test.mjs'].includes('newTest=true')}),
 arbitrate:async()=>({decision:'approve'})});
 assert.equal(result.attempt,2);assert.equal(original['source.mjs'],'export const mode=1;\n');
});
test('wrong paths, unseen literals, duplicate full-source matches and changed pins never enter draft',()=>{
 assert.deepEqual(retain(original,packet,[bad,{...good,path:'secret.env'},{...good,before:'not in shown source'}]),[]);
 assert.deepEqual(retain({...original,'source.mjs':'changed'},packet,[good]),[]);
 const repeated={'source.mjs':original['source.mjs'].repeat(2)};
 assert.deepEqual(retain(repeated,sourceWindows(repeated),[good]),[]);
});
test('new response may correct the same draft, without duplicate application or silent truncation',()=>{
 const updated={...good,after:'export const mode=3;'};
 assert.deepEqual(merge([good],[updated]),[updated]);
 assert.throws(()=>merge(Array.from({length:12},(_,i)=>({...good,path:i+'.mjs'})),[{...good,path:'extra.mjs'}]),/exceeds 12/);
 assert.deepEqual(merge([good],[]),[]);
});
test('semantic review, syntax, tests and arbitration rejection discard stale drafts',()=>{
 for(const stage of ['review','test','arbitration'])assert.equal(sourceDraftRetry({stage,reason:'Model attempted an edit outside the pinned source windows'}),false);
 assert.equal(sourceDraftRetry({stage:'build',reason:'Candidate module syntax failed before review'}),false);
 assert.equal(sourceDraftRetry({stage:'build',reason:'Model attempted an edit outside the pinned source windows'}),true);
});
test('real engine combines drafts before existing full source, syntax, review and test gates',()=>{
 const s=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
 const combine=s.indexOf('proposal.edits=mergeSourceDrafts(sourceExactDrafts,proposal.edits)');
 assert.ok(combine>0&&combine<s.indexOf('!checkVisibleEdits(windowEvidence,proposal.edits)',combine));
 assert.ok(combine<s.indexOf('checkCandidateModuleSyntax(patched)',combine));
 assert.match(s,/await call\('engine-review'/);assert.match(s,/await checks\(candidate.patched\)/);
});
