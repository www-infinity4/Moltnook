import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceWindows,checkVisibleEdits,sha256,patchDigests,boundedPatched} from './context-windows.mjs';
test('184 KB source is represented by bounded, exact anchored source windows',()=>{
 const prefix='noise without the requested element\n'.repeat(5200);
 const src=prefix+'<section id="videoGenerator">Broken 3 images</section>\n'+('other content\n'.repeat(600));
 const pkg=sourceWindows({'index.html':src},{task:'Fix videoGenerator three images'});
 const item=pkg.source['index.html'];
 assert.equal(item.sha256,sha256(src));assert.equal(item.totalChars,src.length);
 assert.ok(JSON.stringify(pkg).length<125000);
 const before='<section id="videoGenerator">Broken 3 images</section>';
 assert.equal(checkVisibleEdits(pkg,[{path:'index.html',before,after:before.replace('Broken','Fixed')}]),true);
 assert.equal(checkVisibleEdits(pkg,[{path:'index.html',before:'noise without the requested element\n'.repeat(300),after:'bad'}]),false);
 assert.notEqual(patchDigests({'index.html':src})['index.html'],patchDigests({'index.html':src+'x'})['index.html']);
 assert.deepEqual(boundedPatched({'index.html':src}),{});
});
test('unshown edits, invalid paths, oversized new source and empty evidence fail closed',()=>{
 const pkg=sourceWindows({'index.html':'<p>top</p>\n'.repeat(15000),'new.css':null},{task:'update top'});
 assert.equal(checkVisibleEdits(pkg,[{path:'new.css',before:null,after:'body{color:#312722}'}]),true);
 assert.equal(checkVisibleEdits(pkg,[{path:'new.css',before:null,after:'x'.repeat(16000)}]),false);
 assert.equal(checkVisibleEdits(pkg,[{path:'wallet.js',before:null,after:'x'}]),false);
 assert.equal(checkVisibleEdits(pkg,[]),false);
});
test('UTF-8 hashes and exact file-size claims are deterministic',()=>{
 assert.match(sha256('é'),/^[0-9a-f]{64}$/);
 const pkg=sourceWindows({'x.css':'p{color:#b83b32}'},{task:'style'});
 assert.equal(pkg.source['x.css'].complete,true);
 assert.equal(pkg.source['x.css'].windows[0].sha256,sha256('p{color:#b83b32}'));
});
