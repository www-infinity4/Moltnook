import test from 'node:test';
import assert from 'node:assert/strict';
import {repairWithFeedback} from './repair-feedback.mjs';
import {sourceWindows,recalculateBounds,checkVisibleEdits,visibleEditFeedback,sha256} from './context-windows.mjs';

test('the actual three-attempt repair loop retries an empty Green response using refreshed pinned source',async()=>{
 const distant='<section id="owner-notification-layout">Job status is only a label</section>';
 const original={'bubbles-ai.js':
  ('function UIJobNotifier(){announceStart();}\n'.repeat(130))+
  ('unrelated read-only code\n'.repeat(2200))+distant+'\n'+
  ('other read-only code\n'.repeat(180))};
 const initial=sourceWindows(original,{task:'UIJobNotifier'});
 const approved={path:'bubbles-ai.js',before:distant,after:distant.replace('only a label','receipt verified')};
 assert.equal(checkVisibleEdits(initial,[approved]),false,'real issue requires a new pinned view');
 let current=initial,attempts=0;const receipts=[];
 const outcome=await repairWithFeedback({
  maxAttempts:3,
  build:async feedback=>{
   attempts++;
   if(attempts===1){
    assert.equal(feedback,undefined);
    const edits=[];
    if(!checkVisibleEdits(current,edits))
     throw Error('Model attempted an edit outside the pinned source windows. '+visibleEditFeedback(current,edits));
   }
   assert.equal(feedback.windowReplan.applied,true);
   assert.equal(current.source['bubbles-ai.js'].sha256,sha256(original['bubbles-ai.js']));
   assert.equal(checkVisibleEdits(current,[approved]),true);
   return {edits:[approved]};
  },
  review:async candidate=>({approved:candidate.edits.length===1}),
  test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),
  restore:async()=>{},
  onFeedback:async feedback=>{
   const recalculated=recalculateBounds(original,current,{
    task:'owner-notification-layout',baseline:initial,
    expansionRatio:1.5,attempt:feedback.attempt
   });
   assert.equal(recalculated.replanned,true);
   current=recalculated;
   feedback.windowReplan={applied:true,sourceHashesUnchanged:true};
   receipts.push({attempt:feedback.attempt,reason:feedback.reason});
  }
 });
 assert.equal(outcome.attempt,2);
 assert.equal(attempts,2);
 assert.equal(receipts.length,1);
 assert.match(receipts[0].reason,/nonempty edits/);
 assert.equal(checkVisibleEdits(initial,[approved]),false,'old snapshot never grants new edit');
 assert.equal(checkVisibleEdits(current,[approved]),true,'only newly shown bytes can be edited');
});

test('no new edit is accepted when the pinned source cannot locate the requested before literal',async()=>{
 const original={'bubbles-ai.js':('UIJobNotifier\n'.repeat(500))+('unrelated\n'.repeat(400))};
 const initial=sourceWindows(original,{task:'UIJobNotifier'});
 const outside={path:'bubbles-ai.js',before:'never existed in pinned SHA',after:'bad'};
 let current=initial;let n=0;
 await assert.rejects(()=>repairWithFeedback({
  maxAttempts:2,
  build:async()=>{
   n++;
   if(!checkVisibleEdits(current,[outside]))
    throw Error('Model attempted an edit outside the pinned source windows. '+visibleEditFeedback(current,[outside]));
   return {edits:[outside]};
  },
  review:async()=>({approved:true}),test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
  onFeedback:async f=>{
   current=recalculateBounds(original,current,{baseline:initial,attempt:f.attempt,rejectedEdits:[outside]});
   assert.equal(checkVisibleEdits(current,[outside]),false);
  }
 }),/Repair attempts exhausted/);
 assert.equal(n,2);
});
