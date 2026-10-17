import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dependencyRequests,collectDependencyContext} from './dependency-context.mjs';
test('task dependencies and Oracle design stay bounded and outside writable target',()=>{
 const r=dependencyRequests('Compare QuantaPhi, Omni-Phi, ShopLC and TV-Database using Moltnook/agents/reuse-radar/widget-layout.mjs; evil/secret.js','www-infinity4/QuantaPhi');
 assert.ok(r.length<=6);assert.ok(r.every(x=>x.repository.startsWith('www-infinity4/')&&x.repository!=='www-infinity4/QuantaPhi'));
 assert.ok(r.find(x=>x.repository.endsWith('/Moltnook')).files.includes('agents/reuse-radar/widget-layout.mjs'));
 assert.ok(r.find(x=>x.repository.endsWith('/Oracle-Octaves')).files.includes('index.html'));
 assert.ok(!JSON.stringify(r).includes('evil'));
});
test('pinned tree and content hashes produce read-only evidence, absent files remain missing',async()=>{
 const bytes=Buffer.from('White Oracle source'),blobSha=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),calls=[];
 const result=await collectDependencyContext({task:'Moltnook/agents/reuse-radar/widget-layout.mjs',target:'www-infinity4/QuantaPhi',github:async route=>{
  calls.push(route);if(route.includes('/commits/'))return {sha:'a'.repeat(40)};
  if(route.includes('/git/trees/'))return {tree:[{type:'blob',path:'README.md',sha:blobSha,size:bytes.length}]};
  if(route.includes('/git/blobs/'))return {encoding:'base64',content:bytes.toString('base64')};
  return {full_name:route.slice(6),default_branch:'main'};
 }});
 assert.equal(result.readOnly,true);assert.ok(result.repositories.every(x=>x.status==='verified_read_only'));
 assert.equal(result.repositories[0].files[0].excerpt,'White Oracle source');
 assert.ok(result.repositories[0].files.some(x=>x.status==='missing_at_pinned_commit'));
 assert.ok(calls.filter(x=>x.includes('/git/trees/')).every(x=>x.includes('a'.repeat(40))));
});
test('failed, truncated or tampered dependencies never become verified',async()=>{
 for(const mode of ['error','truncated','hash']){
 const r=await collectDependencyContext({target:'www-infinity4/QuantaPhi',github:async route=>{
  if(mode==='error')throw Error('GitHub 403');
  if(route.includes('/commits/'))return {sha:'a'.repeat(40)};
  if(route.includes('/git/trees/'))return {truncated:mode==='truncated',tree:[{type:'blob',path:'README.md',sha:'b'.repeat(40),size:3}]};
  if(route.includes('/git/blobs/'))return {encoding:'base64',content:Buffer.from('bad').toString('base64')};
  return {full_name:route.slice(6),default_branch:'main'};
 }});assert.ok(r.repositories.every(x=>x.status==='blocked'));
 }
});

test('Robot Brain reads named QuantaPhi source files from a pinned dependency, including unique basenames',async()=>{
 const task='In www-infinity4/QuantaPhi, inspect workers/infinity-brain-clock/worker.js, runner-auth.mjs and scripts/brain-writer.mjs; diagnose the Moltnook runner.';
 const requested=dependencyRequests(task,'www-infinity4/Moltnook').find(x=>x.repository==='www-infinity4/QuantaPhi');
 assert.ok(requested,'the named owner repository must be a dependency');
 assert.ok(requested.files.includes('workers/infinity-brain-clock/worker.js'));
 assert.ok(requested.files.includes('runner-auth.mjs'));
 assert.ok(requested.files.includes('scripts/brain-writer.mjs'));
 const content=Buffer.from('// signed safe fixture');
 const sha=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+content.length+'\0'),content])).digest('hex');
 const pinnedTree=['README.md','AGENTS.md','workers/infinity-brain-clock/worker.js','workers/infinity-brain-clock/runner-auth.mjs','scripts/brain-writer.mjs']
  .map(p=>({path:p,type:'blob',sha,size:content.length}));
 const data=await collectDependencyContext({task,target:'www-infinity4/Moltnook',github:async route=>{
  if(route.includes('/commits/'))return {sha:'a'.repeat(40)};
  if(route.includes('/git/trees/'))return {tree:pinnedTree};
  if(route.includes('/git/blobs/'))return {encoding:'base64',content:content.toString('base64')};
  return {full_name:route.slice(6),default_branch:'main'};
 }});
 const sources=data.repositories.find(x=>x.repository==='www-infinity4/QuantaPhi');
 assert.equal(sources.status,'verified_read_only');
 for(const p of ['workers/infinity-brain-clock/worker.js','workers/infinity-brain-clock/runner-auth.mjs','scripts/brain-writer.mjs'])
  assert.equal(sources.files.find(x=>x.path===p)?.status,'verified_source',p);
 assert.equal(sources.readOnly,true,'cross-repo evidence never grants writes');
});
test('ambiguous dependency basenames are not silently attributed to the wrong file',async()=>{
 const body=Buffer.from('source'),sha=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+body.length+'\0'),body])).digest('hex');
 const task='QuantaPhi runner-auth.mjs inspect';
 const rows=await collectDependencyContext({task,target:'www-infinity4/Moltnook',github:async route=>{
  if(route.includes('/commits/'))return {sha:'a'.repeat(40)};
  if(route.includes('/git/trees/'))return {tree:['a/runner-auth.mjs','b/runner-auth.mjs'].map(path=>({type:'blob',path,sha,size:body.length}))};
  if(route.includes('/git/blobs/'))return {encoding:'base64',content:body.toString('base64')};
  return {full_name:route.slice(6),default_branch:'main'};
 }});
 const q=rows.repositories.find(x=>x.repository==='www-infinity4/QuantaPhi');
 assert.equal(q.files.find(x=>x.path==='runner-auth.mjs')?.status,'ambiguous_path');
});
