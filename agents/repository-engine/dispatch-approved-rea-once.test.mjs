import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchApprovedReaOnce, assertOneTimeOwnerContext, TITLE} from './dispatch-approved-rea-once.mjs';

const context={eventName:'push',actor:'www-infinity4',ref:'refs/heads/main',repository:'www-infinity4/Moltnook',runAttempt:'1',headMessage:'Request Bubbles approved REA source fork 20261116\n\nReviewed source-only operation'};
function api({owner='www-infinity4',postStatus=204,postError=null}={}){
 const calls=[];
 const request=async(url,init)=>{
  calls.push({url,method:init.method,body:init.body,redirect:init.redirect});
  assert.equal(init.redirect,'manual');
  assert.match(init.headers.authorization,/^Bearer fixture-token$/);
  if(url.endsWith('/user'))return {status:200,json:async()=>({login:owner})};
  if(url.endsWith('/actions/workflows/bubbles-approved-tool-forks.yml/dispatches')){
   if(postError)throw postError;
   return {status:postStatus};
  }
  throw Error('unexpected URL '+url);
 };
 return {calls,request};
}

test('accepted context is exact owner main push and first attempt',()=>{
 assert.equal(assertOneTimeOwnerContext(context),true);
 assert.equal(TITLE,'Request Bubbles approved REA source fork 20261116');
});
test('non-owner, wrong repo, wrong branch, PR event, retry or changed message is blocked',()=>{
 for(const bad of [{actor:'visitor'},{ref:'refs/heads/feature'},{repository:'other/Moltnook'},{eventName:'pull_request'},{runAttempt:'2'},{headMessage:'Other title'},{headMessage:TITLE+' malicious suffix'}]){
  assert.throws(()=>assertOneTimeOwnerContext({...context,...bad}),/owner_only_one_time_dispatch_required/);
 }
});
test('owner token also must identify expected GitHub login before POST',async()=>{
 const a=api({owner:'wrong-identity'});
 await assert.rejects(dispatchApprovedReaOnce('fixture-token',{...context,request:a.request}),/credential_owner_mismatch/);
 assert.equal(a.calls.length,1);
});
test('success is only a dispatch acceptance, never verified fork or runtime',async()=>{
 const a=api();
 const result=await dispatchApprovedReaOnce('fixture-token',{...context,request:a.request});
 assert.equal(result.status,'dispatch_accepted');
 assert.equal(result.forkVerified,false);
 assert.equal(result.runtimeInstalled,false);
 assert.equal(a.calls.length,2);
 assert.equal(a.calls[1].method,'POST');
 assert.deepEqual(JSON.parse(a.calls[1].body),{ref:'main',inputs:{tool:'rea'}});
});
test('HTTP rejection fails closed; no retry',async()=>{
 const a=api({postStatus:403});
 await assert.rejects(dispatchApprovedReaOnce('fixture-token',{...context,request:a.request}),/dispatch_not_accepted_403/);
 assert.equal(a.calls.filter(x=>x.method==='POST').length,1);
});
test('ambiguous POST failure does not retry or claim success',async()=>{
 const a=api({postError:new Error('network timeout')});
 await assert.rejects(dispatchApprovedReaOnce('fixture-token',{...context,request:a.request}),/network timeout/);
 assert.equal(a.calls.filter(x=>x.method==='POST').length,1);
});
test('one-time credential workflow only runs a main owner push, after tests',async()=>{
 const {readFile}=await import('node:fs/promises');
 const y=await readFile(new URL('../../.github/workflows/bubbles-rea-fork-once.yml',import.meta.url),'utf8');
 assert.match(y,/request-fork-once:\n\s+if: ([^\n]+)/);
 const match=y.match(/request-fork-once:\n\s+if: ([^\n]+)/);
 const guard=match[1];
 for(const condition of ["github.event_name == 'push'","github.actor == 'www-infinity4'","github.repository == 'www-infinity4/Moltnook'","github.ref == 'refs/heads/main'","github.run_attempt == 1",TITLE])
  assert.ok(guard.includes(condition),'missing '+condition);
 assert.match(y,/request-fork-once:[\s\S]*?needs: source-tests/);
 assert.match(y,/REPOSITORY_WRITE_TOKEN: \$\{\{ secrets\.GHP \}\}/);
 assert.match(y,/path: repository-receipts\/bubbles-rea-once-dispatch\.json/);
 assert.match(y,/push:\n\s+branches: \[main\]/);
});
