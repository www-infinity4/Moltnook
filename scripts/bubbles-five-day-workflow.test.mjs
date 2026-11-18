import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/bubbles-owner-message.yml',import.meta.url),'utf8');
const signedScript=readFileSync(new URL('./bubbles-signed-chat-acceptance.mjs',import.meta.url),'utf8');

test('explicit workflows expose existing five-day status and signed synthetic chat, not a new grant',()=>{
 assert.match(workflow,/options:\s*\[[^\]]*\bfive_day_status\b[^\]]*\bchat_acceptance\b[^\]]*\]/);
 assert.match(workflow,/\n  five_day_status:\n/);
 assert.match(workflow,/\binputs\.task == 'five_day_status'/);
 assert.match(workflow,/\binputs\.task == 'chat_acceptance'/);
});

test('five-day status request is read-only, signed and fail-closed',()=>{
 const block=workflow.split('\n  five_day_status:\n')[1]?.split(/\n  [a-z][a-z_]*:\n/)[0];
 assert.ok(block,'status job must be a distinct job');
 assert.match(block,/ACTIONS_ID_TOKEN_REQUEST_URL/);
 assert.match(block,/bubbles-owner-message-bridge/);
 assert.match(block,/operation:'status'/);
 assert.match(block,/chatgpt_runner_/);
 assert.match(block,/existing_five_day_approval_not_verified/);
 assert.doesNotMatch(block,/operation:'(?:assist|submit|browser_check)'|bridge-work|grant|renew|api_key/i);
});

test('synthetic conversation reuses the signed owner session and never renews it',()=>{
 assert.match(workflow,/node scripts\/bubbles-signed-chat-acceptance\.mjs/);
 assert.match(signedScript,/operation:'status'/);
 assert.match(signedScript,/wrong_signed_run_identity/);
 assert.match(signedScript,/operation:'assist'/);
 assert.doesNotMatch(signedScript,/operation:'(?:renew|authorize|extend)'/);
});

test('changes to this regression suite trigger pull request security checks',()=>{
 const filter=workflow.split('\n  pull_request:\n')[1]?.split('\n  schedule:\n')[0];
 assert.ok(filter,'the workflow must define pull_request path filters');
 assert.match(filter,/scripts\/bubbles-five-day-workflow\.test\.mjs/,
  'test-only changes must still run build_contracts');
});
