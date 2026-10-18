import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {previewConfig,prepare,CANARY_DB} from './prepare-brain-preview.mjs';

const original=[
 'name = "infinity-brain-clock"',
 'main = "worker.js"',
 'compatibility_date = "2026-10-10"',
 '[[d1_databases]]',
 'binding = "WORK_DB"',
 'database_id = "4aa6a463-02c6-48c3-854f-a87c0ca5f41c"',
 '[[durable_objects.bindings]]',
 'name = "CLOCK"',
 'class_name = "BrainClock"',
 '[[migrations]]',
 'tag = "v1"',
 'new_sqlite_classes = ["BrainClock"]'
].join('\n')+'\n';

test('pinned canary preview uses independent D1 and DO with no wallet or owner secrets',()=>{
 const config=previewConfig(original);
 const preview=config.split('[previews.vars]')[1];
 assert.match(config,/^main = "brain-isolated-probe.mjs"$/m);
 assert.match(preview,/\[\[previews\.d1_databases\]\]/);
 assert.match(preview,/\[\[previews\.durable_objects\.bindings\]\]/);
 assert.ok(preview.includes(CANARY_DB));
 assert.ok(!preview.includes('4aa6a463-02c6-48c3-854f-a87c0ca5f41c'));
 for(const forbidden of ['BOT_WALLET','WRITER_OWNER_HASH','BOT_WORK_SECRET','MODELS','REPOSITORY_WRITE_TOKEN'])
  assert.ok(!preview.includes(forbidden),forbidden);
 assert.equal((config.match(/\[\[previews\.d1_databases\]\]/g)||[]).length,1);
});
test('original live config and preview configuration are never mixed or renamed',()=>{
 const config=previewConfig(original);
 assert.match(config,/^name = "infinity-brain-clock"$/m);
 assert.match(config,/^class_name = "BrainClock"$/m);
 assert.match(config,/^new_sqlite_classes = \["BrainClock"\]$/m);
 assert.throws(()=>previewConfig('name = "different"'),/unexpected_worker_main|production_worker_config_mismatch/);
 assert.throws(()=>previewConfig(config),/unexpected_worker_main|preview_is_already_configured/);
});
test('transient checker only creates preview assets within provided checkout and never copies credentials',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'moltnook-preview-'));
 try{
  fs.writeFileSync(path.join(dir,'worker.js'),'export class BrainClock {}');
  fs.writeFileSync(path.join(dir,'deferred-recovery.mjs'),'export const x=true;');
  fs.writeFileSync(path.join(dir,'wrangler.toml'),original);
  const result=prepare(dir,path.resolve('agents/repository-engine/brain-isolated-probe.mjs'));
  assert.equal(result.isolated,true);
  assert.equal(result.previewD1,CANARY_DB);
  const script=fs.readFileSync(path.join(dir,'brain-isolated-probe.mjs'),'utf8');
  assert.match(script,/sourceRecoveryEligibility/);
  assert.match(script,/filterActiveTickets/);
  assert.match(script,/export \{BrainClock\}/);
  assert.doesNotMatch(script,/BOT_WALLET\.fetch|fetch\('https:\/\/github\.com/);
  assert.match(script,/not_found|Not found/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
