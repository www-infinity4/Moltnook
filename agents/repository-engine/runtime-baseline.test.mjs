import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {focusedTestCommand,inspectRuntime} from './runtime-baseline.mjs';
test('native test globals support CommonJS tests and preserve assertion failures',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'infinity-baseline-'));
 try{
  const file=path.join(dir,'baseline.test.cjs');
  await writeFile(file,"const assert=require('node:assert/strict');describe('baseline',()=>{it('works',()=>assert.equal(1,1));});");
  const options={encoding:'utf8',env:{PATH:process.env.PATH}};
  let r=spawnSync(process.execPath,focusedTestCommand([file]),options);assert.equal(r.status,0,r.stderr+r.stdout);
  await writeFile(file,"const assert=require('node:assert/strict');describe('baseline',()=>{it('fails',()=>assert.equal(1,2));});");
  r=spawnSync(process.execPath,focusedTestCommand([file]),options);assert.notEqual(r.status,0);assert.match(r.stdout,/ERR_ASSERTION/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('configured framework owns its tests; missing tools fail preflight',async()=>{
 assert.equal(focusedTestCommand(['a.test.js'],{scripts:{test:'vitest run'}}),null);
 const report=await inspectRuntime({version:'22.0.0',execute:cmd=>{if(cmd==='python3')throw Error('missing');},renderer:async()=>{throw Error('missing browser')}});
 assert.equal(report.passed,false);assert.deepEqual(report.checks.filter(x=>!x.passed).map(x=>x.name),['Python','Playwright and installed Chromium']);
});
