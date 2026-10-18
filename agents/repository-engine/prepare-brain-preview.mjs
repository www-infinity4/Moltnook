// CI-only: stage a Preview with isolated D1 + separate Durable Object storage.
// This edits only a temporary pinned checkout of QuantaPhi, NEVER upstream.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT=path.resolve('quantaphi-source/workers/infinity-brain-clock');
const PROBE='brain-isolated-probe.mjs';
export const CANARY_DB='76deaa98-5d3a-4151-8390-e14d7da87cb3';
const PRODUCTION_DB='4aa6a463-02c6-48c3-854f-a87c0ca5f41c';

export function previewConfig(original){
 if(!/^main\s*=\s*"worker\.js"\s*$/m.test(original))
  throw Error('unexpected_worker_main');
 if(original.includes('[[previews.d1_databases]]')||
    /^\[previews(?:\.|\])/m.test(original))
  throw Error('preview_is_already_configured');
 if(!original.includes('name = "infinity-brain-clock"')||
    !original.includes('database_id = "'+PRODUCTION_DB+'"')||
    !original.includes('class_name = "BrainClock"'))
  throw Error('production_worker_config_mismatch');
 const config=original.replace(/^main\s*=\s*"worker\.js"\s*$/m,'main = "'+PROBE+'"');
 const preview=[
  '',
  '# Transient isolated Cloudflare Preview. The production configuration above',
  '# is never used to route Preview D1 or singleton Durable Object requests.',
  '[previews.vars]',
  'BRAIN_CANARY_MODE = "isolated"',
  '',
  '[[previews.d1_databases]]',
  'binding = "WORK_DB"',
  'database_name = "infinity-brain-isolated-canary"',
  'database_id = "'+CANARY_DB+'"',
  '',
  '[[previews.durable_objects.bindings]]',
  'name = "CLOCK"',
  'class_name = "BrainClock"',
  ''
 ].join('\n');
 return config+'\n'+preview;
}
export function prepare(root=ROOT,probeFrom=path.resolve('agents/repository-engine/brain-isolated-probe.mjs')){
 const configPath=path.join(root,'wrangler.toml');
 if(!fs.existsSync(path.join(root,'worker.js'))||
    !fs.existsSync(path.join(root,'deferred-recovery.mjs'))||
    !fs.existsSync(configPath)||
    !fs.existsSync(probeFrom))throw Error('pinned_checkout_or_canary_probe_missing');
 const config=previewConfig(fs.readFileSync(configPath,'utf8'));
 const previewPart=config.split('[previews.vars]')[1];
 if(previewPart.includes(PRODUCTION_DB)||
    previewPart.includes('BOT_WALLET')||
    previewPart.includes('WRITER_OWNER_HASH')||
    previewPart.includes('BOT_WORK_SECRET')||
    previewPart.includes('MODELS'))
  throw Error('preview_live_resource_leak');
 fs.copyFileSync(probeFrom,path.join(root,PROBE));
 fs.writeFileSync(configPath,config);
 return {isolated:true,previewD1:CANARY_DB,root};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  prepare();
  console.log('Isolated Brain Preview ready in ephemeral checkout. No credentials or production data copied.');
 }catch(e){console.error(String(e.message||e));process.exitCode=1;}
}
