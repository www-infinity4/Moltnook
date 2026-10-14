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
