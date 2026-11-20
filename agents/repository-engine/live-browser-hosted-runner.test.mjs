import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../../.github/workflows/infinity-live-browser.yml',import.meta.url),'utf8');

test('live mobile browser workflow pins an OS supported by Playwright 1.56.1',()=>{
 const observer=workflow.match(/^  observe:\s*\r?\n    runs-on:\s*(\S+)/m);
 assert.ok(observer,'observer job must identify a runner');
 assert.equal(observer[1],'ubuntu-24.04','Playwright 1.56.1 fails to install Chromium on ubuntu26.04-x64');
 assert.match(workflow,/playwright@1\.56\.1/);
});

test('observer failure preserves evidence without changing authentication or repository writes',()=>{
 assert.match(workflow,/\npermissions:\s*\n  contents: read/);
 assert.match(workflow,/\n  analyze-failure:/);
 assert.match(workflow,/REPAIR_INTAKE_TOKEN:/);
});
