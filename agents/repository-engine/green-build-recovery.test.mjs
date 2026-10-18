import test from 'node:test';
import assert from 'node:assert/strict';
import {requireGreenEdits,greenReplanDecision} from './green-build-recovery.mjs';
import {sourceWindows,recalculateBounds,checkVisibleEdits,sha256} from './context-windows.mjs';
import {repairWithFeedback} from './repair-feedback.mjs';

test('empty Green response keeps the actual model reason rather than misleading schema-only feedback',()=>{
 assert.throws(()=>requireGreenEdits({edits:[],reason:'Need owner-notification-layout from pinned source'}),/Need owner-notification-layout/);
 assert.throws(()=>requireGreenEdits({reason:'No source'}),/no edits array/);
 assert.deepEqual(requireGreenEdits({edits:[{path:'a.js',before:'x',after:'y'}]}),
  [{path:'a.js',before:'x',after:'y'}]);
 const r=greenReplanDecision({stage:'build',reason:'Green returned no bounded edits: owner-notification-layout'},'UIJobNotifier');
 assert.equal(r.eligible,true);assert.ok(r.task.startsWith('owner-notification-layout'));
 assert.equal(r.permissionsExpanded,false);
 assert.equal(greenReplanDecision({stage:'review',reason:'Green returned no bounded edits: x'},'task').eligible,false);
 assert.equal(greenReplanDecision({stage:'build',reason:'credential denied'},'task').eligible,false);
});
test('actual feedback loop can inspect an additional pinned region and recover an empty Green edit',async()=>{
 const distant='<section id="owner-notification-layout">Old label</section>';
 const original={'bubbles-ai.js':('function UIJobNotifier(){announceStart()}\n'.repeat(150))+
  ('unrelated code\n'.repeat(2000))+distant+'\n'+('trailing code\n'.repeat(130))};
 const first=sourceWindows(original,{task:'UIJobNotifier'});
 const edit={path:'bubbles-ai.js',before:distant,after:distant.replace('Old label','Receipt checked')};
 assert.equal(checkVisibleEdits(first,[edit]),false);
 let current=first,count=0;const failures=[];
 const result=await repairWithFeedback({
  build:async()=>{
   count++;
   if(count===1)requireGreenEdits({edits:[],reason:'Edit the owner-notification-layout section'});
   const edits=requireGreenEdits({edits:[edit]});
   assert.equal(checkVisibleEdits(current,edits),true);
   return {edits};
  },
  review:async()=>({approved:true}),test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
  onFeedback:async feedback=>{
   const focus=greenReplanDecision(feedback,'UIJobNotifier');
   assert.equal(focus.eligible,true);
   current=recalculateBounds(original,current,{baseline:first,attempt:feedback.attempt,
    expansionRatio:1.5,task:focus.task,rejectedEdits:[]});
   assert.equal(current.replanned,true);
   assert.equal(current.source['bubbles-ai.js'].sha256,sha256(original['bubbles-ai.js']));
   failures.push(feedback.reason);
  }
 });
 assert.equal(result.attempt,2);assert.equal(count,2);
 assert.match(failures[0],/owner-notification-layout/);
 assert.equal(checkVisibleEdits(first,[edit]),false);
 assert.equal(checkVisibleEdits(current,[edit]),true);
});
test('the same retry mechanism never accepts a missing, unpinned edit',async()=>{
 const original={'a.js':('function verifyOwner(){}\n'.repeat(200))};
 let current=sourceWindows(original,{task:'verifyOwner'}),calls=0;
 await assert.rejects(repairWithFeedback({
  maxAttempts:2,
  build:async()=>{
   calls++;
   const edits=requireGreenEdits({edits:[],reason:'Need a non-existent sensitive owner adapter'});
   assert.equal(checkVisibleEdits(current,edits),false);
   return {edits};
  },
  review:async()=>({approved:true}),test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
  onFeedback:async f=>{
   const focus=greenReplanDecision(f,'verifyOwner');
   current=recalculateBounds(original,current,{baseline:sourceWindows(original,{task:'verifyOwner'}),
    attempt:f.attempt,task:focus.task});
  }
 }),/Repair attempts exhausted/);
 assert.equal(calls,2);
});
