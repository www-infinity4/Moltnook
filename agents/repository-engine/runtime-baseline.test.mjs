import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {focusedTestCommand,inspectRuntime,missingAcceptanceAdapterMessage,repositoryNodeTests,commandReceipt,compactRepositoryChecks} from './runtime-baseline.mjs';
import {repairWithFeedback} from './repair-feedback.mjs';
import {applyEdits} from './patch.mjs';
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

test('documentation-only proposals do not manufacture a passing verification receipt',()=>{
 const msg=missingAcceptanceAdapterMessage(['docs/validation-decision-report.md']);
 assert.match(msg,/Documentation-only patch has no executable acceptance check/);
 assert.match(msg,/Do not claim test or browser results/);
 assert.match(missingAcceptanceAdapterMessage(['assets/config.json']),/configured test or build acceptance adapter/);
});

test('an unchanged pinned behavioral test is selected for an implementation-only edit',()=>{
 const tracked=['src/login.mjs','test/login.test.mjs','test/unrelated.test.mjs'];
 assert.deepEqual(repositoryNodeTests(['src/login.mjs'],['src/login.mjs','test/login.test.mjs','test/nonexistent.test.mjs'],tracked,['test/unrelated.test.mjs']),['test/login.test.mjs']);
 assert.deepEqual(repositoryNodeTests(['src/login.mjs'],[],tracked,['test/login.test.mjs','test/nonexistent.test.mjs']),['test/login.test.mjs']);
});

test('a real failing terminal check feeds a corrected patch and a passing recheck',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'infinity-repair-'));
 const original={'login.mjs':"export const login=()=>401;\n"};
 const checks=[];
 try{
  await writeFile(path.join(dir,'login.test.mjs'),`
    import {strictEqual} from 'node:assert';
    import {login} from './login.mjs';
    console.log('checking actual login response');
    console.error('login route diagnostics');
    strictEqual(login(),200,'login must succeed');
  `);
  const result=await repairWithFeedback({
   build:async feedback=>{
    if(feedback){
     assert.equal(feedback.stage,'test');
     assert.equal(checks[0].exitCode,1);
     assert.match(checks[0].output,/login must succeed/);
     assert.match(checks[0].output,/checking actual login response/);
     assert.match(checks[0].output,/login route diagnostics/);
    }
    return applyEdits(original,[{path:'login.mjs',before:'()=>401',after:feedback?'()=>200':'()=>403'}]);
   },
   review:async()=>({approved:true}),
   test:async patch=>{
    await writeFile(path.join(dir,'login.mjs'),patch['login.mjs']);
    const run=commandReceipt('Login tests',()=>execFileSync(process.execPath,focusedTestCommand(['login.test.mjs']),
     {cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH}}));
    const result=compactRepositoryChecks({passed:run.passed,runs:[run]});
    checks.push(result.runs[0]);
    return result;
   },
   arbitrate:async()=>({decision:'approve'}),
   restore:async()=>writeFile(path.join(dir,'login.mjs'),original['login.mjs']),
   onFeedback:async()=>{}
  });
  assert.equal(result.attempt,2);
  assert.deepEqual(checks.map(check=>check.exitCode),[1,0]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
