import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {withRepositorySandbox} from './execution-sandbox.mjs';
import {focusedTestCommand,nodeTestBootstrap} from './runtime-baseline.mjs';
import {archiveScreenshots} from './archive-screenshots.mjs';

test('dependency acquisition and offline checks share only a disposable source copy',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bubbles-isolation-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.mkdir(path.join(dir,'.git'));
 await fs.writeFile(path.join(dir,'.git','config'),'sentinel');
 await fs.writeFile(path.join(dir,'check.test.mjs'),'before');
 const calls=[];
 const failure=Object.assign(Error('command timed out'),{code:'ETIMEDOUT'});
 let checkout;
 await withRepositorySandbox(dir,run=>{
  assert.throws(()=>run('npm',['install']),/Unsafe dependency install/);
  run('npm',['install','--ignore-scripts','--package-lock=false','--no-audit','--no-fund']);
  assert.throws(()=>run('node',focusedTestCommand(['check.test.mjs'])),error=>error===failure);
 },{execute:(program,args,options)=>{
  assert.equal(program,'docker');
  assert.deepEqual(Object.keys(options.env).sort(),['DOCKER_CONFIG','PATH']);
  calls.push(args);
  if(args[0]==='rm')return '';
  const mounts=args.filter((_,i)=>args[i-1]==='--mount');
  assert.equal(mounts.length,2);
  assert.equal(mounts[1],'type=bind,source='+nodeTestBootstrap+',target=/opt/infinity/node-test-globals.mjs,readonly');
  checkout=mounts[0].match(/^type=bind,source=(.*),target=\/workspace$/)[1];
  assert.notEqual(checkout,dir);
  assert.ok(!existsSync(path.join(checkout,'.git')));
  assert.ok(args.includes('--read-only'));
  assert.ok(args.includes('--cap-drop=ALL'));
  assert.ok(args.includes('--security-opt=no-new-privileges'));
  if(calls.length===1){
   assert.equal(args[args.indexOf('--network')+1],'bridge');
   writeFileSync(path.join(checkout,'check.test.mjs'),'inside');
   return '';
  }
  assert.equal(args[args.indexOf('--network')+1],'none');
  assert.ok(args.includes('/opt/infinity/node-test-globals.mjs'));
  assert.equal(readFileSync(path.join(checkout,'check.test.mjs'),'utf8'),'inside');
  throw failure;
 }});
 assert.deepEqual(calls[2],['rm','--force',calls[1][calls[1].indexOf('--name')+1]]);
 assert.equal(await fs.readFile(path.join(dir,'check.test.mjs'),'utf8'),'before');
 assert.ok(!existsSync(checkout));
});

test('real Docker check cannot see controller credentials, files, or network', {skip:process.env.BUBBLES_TEST_DOCKER!=='1'},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bubbles-docker-smoke-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const source=path.join(dir,'source'),outside=path.join(dir,'controller-private');
 await fs.mkdir(source);
 await fs.writeFile(outside,'synthetic secret');
 await fs.writeFile(path.join(source,'check.test.mjs'),[
  "import assert from 'node:assert/strict';",
  "import {existsSync,readFileSync,writeFileSync} from 'node:fs';",
  "import {networkInterfaces} from 'node:os';",
  "assert.equal(process.env.BUBBLES_CONTROLLER_SENTINEL,undefined);",
  "let pidEnvironment='';",
  "try{pidEnvironment=readFileSync('/proc/1/environ','utf8');}catch(error){assert.ok(['EACCES','EPERM','ENOENT'].includes(error.code));}",
  "assert.doesNotMatch(pidEnvironment,/BUBBLES_CONTROLLER_SENTINEL/);",
  'assert.equal(existsSync('+JSON.stringify(outside)+'),false);',
  "assert.deepEqual(Object.keys(networkInterfaces()),['lo']);",
  "writeFileSync('generated.txt','container only');"
 ].join('\n'));
 process.env.BUBBLES_CONTROLLER_SENTINEL='synthetic';
 try{
  await withRepositorySandbox(source,run=>run('node',focusedTestCommand(['check.test.mjs'])));
 }finally{delete process.env.BUBBLES_CONTROLLER_SENTINEL;}
 assert.ok(!existsSync(path.join(source,'generated.txt')));
 assert.equal(await fs.readFile(outside,'utf8'),'synthetic secret');
});

test('screenshot archival ignores symlinks and rejects non-image content',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bubbles-images-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const output=path.join(dir,'receipts'),outside=path.join(dir,'outside.png');
 await fs.mkdir(output);
 await fs.writeFile(outside,'private');
 await fs.symlink(outside,path.join(output,'aliased.png'));
 const sent=[];
 const send=async(_step,body)=>{sent.push(body);return {ok:true,evidence:{key:'screenshot'}};};
 const receipt={repository:'www-infinity4/Moltnook',commitSha:'a'.repeat(40)};
 assert.deepEqual(await archiveScreenshots(output,receipt,send),[]);
 await fs.writeFile(path.join(output,'fake.png'),'not an image');
 await assert.rejects(archiveScreenshots(output,receipt,send),/Invalid screenshot content/);
 assert.deepEqual(sent,[]);
});
