import test from 'node:test';
import assert from 'node:assert/strict';
import {feedback,gradeTwoAttempts} from './bubbles-oracle-refinement.mjs';
test('grader gives repair instructions for missing white cards and button handler',()=>{
 const incomplete='<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><style>body{background:#f7f4f0}</style><main><button>Action</button></main></html>';
 const x=gradeTwoAttempts(incomplete,incomplete);
 assert.equal(x.initial.score,65);
 assert.equal(x.revision.score,65);
 assert.deepEqual(feedback(x.initial).missing,['white_card_css','observable_button']);
 assert.match(feedback(x.initial).actions.join(' '),/background-color: #fff/);
 assert.match(feedback(x.initial).actions.join(' '),/addEventListener/);
 assert.equal(x.clickVerified,false);
});
test('source improvement is measured, not called a browser event',()=>{
 const simple='<main>description only</main>';
 const fixed='<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><style>body{background:#f7f4f0;color:#312722}.card{background:#fff}</style><main><article class="card"></article><article class="card"></article><button id="go">Go</button><span id="status"></span><script>document.querySelector("#go").addEventListener("click",()=>document.querySelector("#status").textContent="clicked")</script></main></html>';
 const result=gradeTwoAttempts(simple,fixed);
 assert.equal(result.revision.score,100);
 assert.equal(result.improved,true);
 assert.equal(result.sourcePass,true);
 assert.equal(result.rendered,false);
 assert.equal(result.clickVerified,false);
 assert.equal(result.actionsExecuted,false);
});
