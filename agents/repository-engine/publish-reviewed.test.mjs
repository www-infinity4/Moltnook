import test from 'node:test';
import assert from 'node:assert/strict';
import {publishReviewed} from './publish-reviewed.mjs';
const input={repository:'www-infinity4/QuantaPhi',base:'main',commitSha:'a'.repeat(40),jobId:'ticket/TASK-1',runId:'123'};
test('protected branch produces reviewed branch and exact PR receipt without bypassing protection',async()=>{const pushes=[];const r=await publishReviewed({...input,push:async ref=>{pushes.push(ref);if(ref==='HEAD:main')throw Error('GH013 Changes must be made through a pull request')},api:async(path,request)=>{assert.equal(request.body.base,'main');return {html_url:'https://github.com/www-infinity4/QuantaPhi/pull/1',number:1,head:{sha:input.commitSha}}}});assert.equal(r.publishedToDefault,false);assert.equal(r.status,'committed_unverified');assert.ok(pushes[1].startsWith('HEAD:refs/heads/robot/'));assert.ok(pushes.every(x=>!x.includes('--force')));});
test('network and permission failures do not masquerade as protection or publication',async()=>{await assert.rejects(publishReviewed({...input,push:async()=>{throw Error('credential denied')},api:async()=>{throw Error('must not call')}}),/credential denied/)});
