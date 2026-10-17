import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchRunnerOidcIdentity} from './credential-bridge.mjs';

test('Moltnook executor uses the same bounded and signed identity routine as credential bridge',async()=>{
 const source=await readFile(new URL('./runner.mjs',import.meta.url),'utf8');
 assert.match(source,/import\s+\{fetchRunnerOidcIdentity\}\s+from '\.\/credential-bridge\.mjs'/);
 const call=source.slice(source.indexOf('async function call('),source.indexOf('async function event('));
 assert.match(call,/const value=await fetchRunnerOidcIdentity\(\)/);
 assert.doesNotMatch(call,/ACTIONS_ID_TOKEN_REQUEST_URL|ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
 assert.doesNotMatch(call,/Authorization:\s*'Bearer '\+process\.env/);
 assert.match(call,/fetch\(API\+'\/runner\/'\+step/);
 assert.equal(typeof fetchRunnerOidcIdentity,'function');
});
