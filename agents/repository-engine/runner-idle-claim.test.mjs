import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRunnerIdle} from './runner-idle-claim.mjs';

test('record safe backend admission reason in signed runner receipts',()=>{
 const receipt=parseRunnerIdle({lease:null,idle:{code:'admission_deferred',examined:7,admitted:0,deferred:7,adapterMatches:0,agedOut:6,scanLimited:false,ticketId:'private'}});
 assert.deepEqual(receipt,{code:'admission_deferred',examined:7,admitted:0,deferred:7,adapterMatches:0,agedOut:6,scanLimited:false});
 assert.ok(!JSON.stringify(receipt).includes('private'));
});
test('a claimed lease is not marked idle',()=>{
 assert.equal(parseRunnerIdle({lease:{jobId:'TASK-1'},idle:{code:'owner_queue_empty'}}),null);
});
test('unsupported or missing code cannot leak untrusted private details',()=>{
 assert.deepEqual(parseRunnerIdle({lease:null,idle:{code:'Bearer secret',reason:'token'}}),{code:'reason_unavailable'});
 assert.deepEqual(parseRunnerIdle({lease:null}),{code:'reason_unavailable'});
});
