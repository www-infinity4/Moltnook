import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_REPOS, selectRepository, normalizeTree, directoryTiles, layoutTiles, sourceLink } from './explorer-core.mjs';

const sha = 'a'.repeat(40);
const tree = [
 {path:'agents/repository-engine/runner.mjs',type:'blob',size:100},
 {path:'agents/repository-engine/runner.test.mjs',type:'blob',size:50},
 {path:'agents/roster.json',type:'blob',size:25},
 {path:'index.html',type:'blob',size:75},
 {path:'agents',type:'tree'},
];

test('limits browsing to known public source repositories',()=>{
 assert.deepEqual(Object.keys(ALLOWED_REPOS),['moltnook','quantaphi','makepad']);
 assert.equal(selectRepository('makepad').fullName,'makepad/makepad');
 assert.throws(()=>selectRepository('../secret'), /unsupported repository/i);
 assert.throws(()=>selectRepository('other/repo'), /unsupported repository/i);
});

test('normalizes public GitHub tree without treating truncation as complete',()=>{
 const out=normalizeTree({tree,truncated:true,sha});
 assert.equal(out.complete,false);
 assert.equal(out.files.length,4);
 assert.equal(out.files.find(f=>f.path==='index.html').size,75);
 assert.equal(out.totalBytes,250);
 assert.equal(out.sha,sha);
});

test('rejects unsafe paths, duplicate files and invalid tree payloads',()=>{
 const out=normalizeTree({sha, tree:[
  {path:'ok.js',type:'blob',size:7}, {path:'ok.js',type:'blob',size:999},
  {path:'../secret.js',type:'blob',size:2},
  {path:'/absolute.js',type:'blob',size:2},
  {path:'bad\\slash.js',type:'blob',size:2},
  {path:'x.js',type:'blob',size:-3},
  {path:'README.md',type:'tree'}
 ]});
 assert.deepEqual(out.files,[{path:'ok.js',size:7}]);
 assert.throws(()=>normalizeTree({tree:[]} ), /invalid GitHub tree/i);
});

test('directory tiles navigate by actual source path, not imagined symbols',()=>{
 const files=normalizeTree({tree,sha}).files;
 const top=directoryTiles(files);
 assert.deepEqual(top.map(n=>n.path),['agents','index.html']);
 assert.equal(top[0].bytes,175);
 assert.equal(top[0].files,3);
 assert.equal(top[0].directory,true);
 const sub=directoryTiles(files,'agents');
 assert.deepEqual(sub.map(n=>n.path),['agents/repository-engine','agents/roster.json']);
 assert.deepEqual(directoryTiles(files,'missing'),[]);
});

test('layout uses finite, nonoverlapping positive rectangles',()=>{
 const rects=layoutTiles(directoryTiles(normalizeTree({tree,sha}).files),500,200);
 assert.equal(rects.length,2);
 for(const r of rects){
  assert.ok(Number.isFinite(r.x+r.y+r.width+r.height));
  assert.ok(r.width>0&&r.height>0);
  assert.ok(r.x>=0 && r.y>=0 && r.x+r.width<=500.0001 && r.y+r.height<=200.0001);
 }
 const [a,b]=rects;
 assert.equal(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y, true);
 assert.deepEqual(layoutTiles([],500,200),[]);
});

test('source links are commit-pinned and cannot leave approved repositories',()=>{
 assert.equal(sourceLink('moltnook',sha,'agents/runner.mjs'),`https://github.com/www-infinity4/Moltnook/blob/${sha}/agents/runner.mjs`);
 assert.throws(()=>sourceLink('moltnook','main','index.html'),/invalid revision/i);
 assert.throws(()=>sourceLink('moltnook',sha,'../secret'),/invalid source path/i);
 assert.throws(()=>sourceLink('evil/repo',sha,'ok.js'),/unsupported repository/i);
});

