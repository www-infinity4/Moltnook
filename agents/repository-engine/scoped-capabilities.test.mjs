import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverScopedCapabilities} from './scoped-capabilities.mjs';
import {safePath} from './patch.mjs';
test('reader derives existing scoped runner and worker facts without inventing tokens',async()=>{
 const workflow=[
  'name: Infinity brain repository writer',
  'on:',
  '  push:',
  "    paths: ['scripts/brain-*.mjs', 'workers/infinity-brain-clock/**']",
  'permissions:',
  '  contents: write',
  '  id-token: write',
  'jobs:',
  '  repair:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - run: node --test test/brain-writer.test.mjs',
  '      - env: { API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }} }'
 ].join('\n');
 const read=[],sources={'workers/infinity-brain-clock/wrangler.toml':'name = "infinity-brain-clock"\nmain = "worker.js"\nbinding = "WORK_DB"\ndatabase_name = "rogers-consensus"'};
 const result=await discoverScopedCapabilities({
  paths:['.github/workflows/brain-writer.yml','.github/workflows/../../secret.yml','.env','workers/infinity-brain-clock/wrangler.toml','scripts/brain-writer.mjs'],
  readWorkflow:async p=>{read.push(p);return workflow},
  readSource:async p=>sources[p]});
 assert.deepEqual(read,['.github/workflows/brain-writer.yml']);
 assert.equal(result.existingWorkflows[0].path,'.github/workflows/brain-writer.yml');
 assert.deepEqual(result.runnerImages,['ubuntu-latest']);
 assert.ok(result.testCommands.includes('node --test test/brain-writer.test.mjs'));
 assert.ok(result.permissions.includes('contents: write'));
 assert.equal(result.cloudflare[0].workerName,'infinity-brain-clock');
 assert.equal(result.cloudflare[0].databases[0],'rogers-consensus');
 assert.equal(result.cloudflare[0].secretValuesAvailable,false);
 assert.ok(result.knownSourcePaths.includes('scripts/brain-writer.mjs'));
 assert.ok(!result.knownSourcePaths.some(p=>p.startsWith('.github')));
 assert.ok(!JSON.stringify(result).includes('CLOUDFLARE_API_TOKEN'));
 assert.throws(()=>safePath('.github/workflows/brain-writer.yml'));
 assert.equal(result.cloudflare[0].deploymentVerified,false);
});
test('absent workflows and wrangler remain absent, not invented capabilities',async()=>{
 const result=await discoverScopedCapabilities({paths:['index.html'],readWorkflow:async()=>{throw Error('must not read')},readSource:async()=>''});
 assert.deepEqual(result.existingWorkflows,[]);
 assert.deepEqual(result.testCommands,[]);
 assert.deepEqual(result.cloudflare,[]);
 assert.equal(result.writerPolicy.includes('excluded'),true);
});
test('workflow metadata remains bounded and strips credential expressions',async()=>{
 const workflow=['name: build','jobs:','  test:','    runs-on: ubuntu-latest','    steps:','      - run: node --test test/build.test.mjs','      - run: node --test \${{ secrets.SECRET_TEST_COMMAND }}','      - env: { TOKEN: \${{ secrets.PRIVATE_TEST_TOKEN }} }'].join('\n');
 const result=await discoverScopedCapabilities({paths:['.github/workflows/build.yml'],readWorkflow:async()=>workflow,readSource:async()=>''});
 assert.ok(!JSON.stringify(result).includes('SECRET_TEST_COMMAND'));
 assert.ok(!JSON.stringify(result).includes('PRIVATE_TEST_TOKEN'));
 assert.deepEqual(result.testCommands,['node --test test/build.test.mjs']);
});
