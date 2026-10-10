import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executionContext} from './execution-context.mjs';
import {verifyAdapters} from './adapter-verification.mjs';
const main={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'www-infinity4/Moltnook',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule'};
test('fork and PR contexts cannot inherit main production access',()=>{
 assert.equal(executionContext(main).productionAccess,true);
 for(const change of [{IS_FORK:'true'},{TARGET_ENV:'FORK'},{GITHUB_HEAD_REF:'feature'},{GITHUB_EVENT_NAME:'pull_request_target'},{GITHUB_REPOSITORY:'other/Moltnook'},{GITHUB_REF:'refs/heads/staging'}])assert.equal(executionContext({...main,...change}).productionAccess,false);
 assert.equal(executionContext({}).productionAccess,false);
});
test('isolated harness makes no requests even when production credentials exist',async()=>{
 let calls=0;const r=await verifyAdapters({context:executionContext({...main,IS_FORK:'true'}),walletToken:'private',githubToken:'private',fetcher:async()=>{calls++;throw Error('must not call production')}});
 assert.equal(calls,0);assert.equal(r.mode,'isolated');for(const adapter of Object.values(r.adapters))assert.equal(adapter.status,'disabled_isolated_context');assert.ok(!JSON.stringify(r).includes('private'));
});
