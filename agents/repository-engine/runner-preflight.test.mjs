import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {safePath,inside} from './patch.mjs';

const runner=await fs.readFile(new URL('./runner.mjs',import.meta.url),'utf8');
function strictReader(workspace,filesystem=fs){
 const begin=runner.indexOf('async function sourceFile(');
 const end=runner.indexOf('async function checks(',begin);
 assert.ok(begin>=0&&end>begin,'exercise the actual strict runner source reader');
 return new Function('safePath','inside','workspace','path','fs',
  runner.slice(begin,end)+'\nreturn sourceFile;')(safePath,inside,workspace,path,filesystem);
}
async function optionalRead(...args){
 const {readOptionalRootReadme}=await import('./runner-preflight.mjs');
 return readOptionalRootReadme(...args);
}
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'bubbles-root-readme-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const workspace=path.join(root,'checkout');
 await fs.mkdir(workspace);
 return {root,workspace,read:strictReader(workspace)};
}

test('runner uses optional discovery only for the root README and reads AGENTS strictly',()=>{
 assert.ok(/import\s+\{readOptionalRootReadme\}\s+from '\.\/runner-preflight\.mjs'/.test(runner),
  'runner must import the narrow optional README helper');
 assert.ok(/const readme=await readOptionalRootReadme\(sourceFile,report\),agents=await sourceFile\('AGENTS\.md'\)/.test(runner),
  'only the optional root README may use the skip policy');
});
test('optional discovery reads real README content and distinguishes a missing root file',async t=>{
 const {workspace,read}=await fixture(t),report={};
 await fs.writeFile(path.join(workspace,'README.md'),'Owner repository overview.\n');
 assert.equal(await optionalRead(read,report),'Owner repository overview.\n');
 assert.deepEqual(report.rootReadme,{path:'README.md',state:'read'});
 await fs.unlink(path.join(workspace,'README.md'));
 assert.equal(await optionalRead(read,report),null);
 assert.deepEqual(report.rootReadme,{path:'README.md',state:'missing'});
});
test('real symlink README is refused by strict reads and skipped only during optional discovery',async t=>{
 const {root,workspace}=await fixture(t),report={};
 const target=path.join(root,'outside.txt');
 await fs.writeFile(target,'synthetic target must not be read');
 await fs.symlink(target,path.join(workspace,'README.md'));
 let reads=0;
 const read=strictReader(workspace,{...fs,readFile:async()=>{reads++;throw Error('symlink target was followed');}});
 await assert.rejects(read('README.md'),{message:'Writer refuses symlink source',code:'writer_symlink_source'});
 assert.equal(await optionalRead(read,report),null);
 assert.equal(reads,0,'the helper must never materialize or follow the target');
 assert.deepEqual(report.rootReadme,{path:'README.md',state:'skipped_symlink'});
 assert.equal(await fs.readFile(target,'utf8'),'synthetic target must not be read');
});
test('linked AGENTS and requested source files retain the strict typed refusal',async t=>{
 const {root,workspace,read}=await fixture(t);
 const target=path.join(root,'outside.txt');
 await fs.writeFile(target,'synthetic outside source');
 await fs.mkdir(path.join(workspace,'src'));
 for(const file of ['AGENTS.md','src/required.mjs']){
  await fs.symlink(target,path.join(workspace,file));
  await assert.rejects(read(file),{message:'Writer refuses symlink source',code:'writer_symlink_source'});
 }
});
test('a symlink in a requested source ancestor is refused without reading its target',async t=>{
 const {root,workspace}=await fixture(t),outside=path.join(root,'outside');
 await fs.mkdir(outside);await fs.writeFile(path.join(outside,'required.mjs'),'synthetic source');
 await fs.symlink(outside,path.join(workspace,'src'),'dir');
 let reads=0;
 const read=strictReader(workspace,{...fs,readFile:async()=>{reads++;throw Error('linked ancestor followed');}});
 await assert.rejects(read('src/required.mjs'),{message:'Writer refuses symlink source',code:'writer_symlink_source'});
 assert.equal(reads,0);
});
test('only the typed symlink refusal can be skipped and the report contains no target or error text',async()=>{
 const report={},refusal=Object.assign(Error('synthetic-private-target'),{code:'writer_symlink_source'});
 let calls=0;
 assert.equal(await optionalRead(async file=>{calls++;assert.equal(file,'README.md');throw refusal;},report),null);
 assert.equal(calls,1);
 assert.deepEqual(report,{rootReadme:{path:'README.md',state:'skipped_symlink'}});
 for(const error of [Error('Writer refuses symlink source'),Object.assign(Error('permission denied'),{code:'EACCES'}),Object.assign(Error('missing'),{code:'ENOENT'})]){
  await assert.rejects(optionalRead(async()=>{throw error;},report),actual=>actual===error);
 }
 assert.deepEqual(report,{rootReadme:{path:'README.md',state:'skipped_symlink'}});
});
test('optional README handling does not swallow real source size and filesystem errors',async t=>{
 const {workspace,read}=await fixture(t);
 await fs.writeFile(path.join(workspace,'README.md'),'oversized fixture');
 await assert.rejects(optionalRead(file=>read(file,2),{}),/Source requires a smaller task: README\.md/);
 const denied=Object.assign(Error('synthetic permission denial'),{code:'EACCES'});
 const deniedRead=strictReader(workspace,{...fs,lstat:async()=>{throw denied;}});
 await assert.rejects(optionalRead(deniedRead,{}),error=>error===denied);
});
test('strict source paths reject traversal and credentials before any filesystem access',async t=>{
 const {workspace}=await fixture(t);
 const read=strictReader(workspace,{...fs,lstat:async()=>assert.fail('unsafe path reached filesystem')});
 for(const file of ['../README.md','/README.md','.env','src/secrets/key.mjs'])
  await assert.rejects(read(file),/Source path is outside writer policy/);
});
