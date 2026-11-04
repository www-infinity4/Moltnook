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

test('aggregate post-admission reasons are whitelisted without exposing raw upstream data',()=>{
 const receipt=parseRunnerIdle({lease:null,idle:{code:'eligible_but_not_claimed',examined:309,
  admitted:3,deferred:306,adapterMatches:2,agedOut:176,scanLimited:true,
  claimBlockedBy:{dependency_pending:1,repository_lease_active:1,runner_backoff:8000,
   'Bearer token':42}}});
 assert.deepEqual(receipt.claimBlockedBy,{dependency_pending:1,repository_lease_active:1,runner_backoff:0});
 assert.ok(!JSON.stringify(receipt).includes('Bearer'));
});
