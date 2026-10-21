import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceWindows,recalculateBounds,checkVisibleEdits,normalizeVisibleEdits,visibleEditFeedback,sha256,patchDigests,boundedPatched} from './context-windows.mjs';
import {readFileSync} from 'node:fs';
test('actual runner publication code is visible when the job asks for final git push context',()=>{
 const full=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
 const literal="command('git',['push','origin',ref]";
 assert.ok(full.includes(literal));
 const packet=sourceWindows({'agents/repository-engine/runner.mjs':full},{task:'Inspect the final git push and surrounding control flow'});
 assert.ok(packet.source['agents/repository-engine/runner.mjs'].windows.some(w=>w.text.includes(literal)));
 assert.equal(packet.source['agents/repository-engine/runner.mjs'].sha256,sha256(full));
 assert.ok(packet.source['agents/repository-engine/runner.mjs'].windows.reduce((n,w)=>n+w.text.length,0)<=7000);
});
test('missing-context feedback replans to the real git operation beyond early push references',()=>{
 const target="command('git',['push','origin',ref]);";
 const full=('const item = values.push(value); // source code\n'.repeat(1000))+target+'\n'+('tail\n'.repeat(1000));
 const original={'runner.mjs':full},first=sourceWindows(original,{task:'values source'});
 const shifted=recalculateBounds(original,first,{baseline:first,task:'Missing source window for the final git push and surrounding control flow',attempt:1});
 assert.equal(checkVisibleEdits(first,[{path:'runner.mjs',before:target,after:target+'\n'}]),false);
 assert.equal(checkVisibleEdits(shifted,[{path:'runner.mjs',before:target,after:target+'\n'}]),true);
 assert.equal(shifted.source['runner.mjs'].sha256,first.source['runner.mjs'].sha256);
});
test('closing body context selects the real footer without granting missing file access',()=>{
 const full='<body>\n'+('body content\n'.repeat(6000))+'</body></html>';
 const packet=sourceWindows({'index.html':full},{task:'Insert before the closing body tag'});
 assert.equal(checkVisibleEdits(packet,[{path:'index.html',before:'</body>',after:'<footer>Text</footer></body>'}]),true);
 assert.equal(checkVisibleEdits(packet,[{path:'secret.js',before:'</body>',after:'bad'}]),false);
});
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
 assert.match(visibleEditFeedback(pkg,[]),/Expected a nonempty edits array/);
 assert.match(visibleEditFeedback(pkg,[]),/exact before substring/);
 assert.match(visibleEditFeedback(pkg,[]),/before:null/);
});
test('UTF-8 hashes and exact file-size claims are deterministic',()=>{
 assert.match(sha256('é'),/^[0-9a-f]{64}$/);
 const pkg=sourceWindows({'x.css':'p{color:#b83b32}'},{task:'style'});
 assert.equal(pkg.source['x.css'].complete,true);
 assert.equal(pkg.source['x.css'].windows[0].sha256,sha256('p{color:#b83b32}'));
});
test('new-file retry receives its exact null contract without accepting an invalid edit or leaking source',()=>{
 const packet=sourceWindows({'test/canary.mjs':null,'existing.js':'private-source-marker'},{task:'canary'});
 const edits=[{path:'test/canary.mjs',before:'',after:'private-proposal-marker'}];
 assert.equal(checkVisibleEdits(packet,edits),false);
 const feedback=visibleEditFeedback(packet,edits);
 assert.match(feedback,/before:null/);assert.match(feedback,/before type string/);
 assert.ok(!feedback.includes('private-proposal-marker'));assert.ok(!feedback.includes('private-source-marker'));
 const corrected=[{...edits[0],before:null}];
 assert.equal(checkVisibleEdits(packet,corrected),true);
 assert.equal(checkVisibleEdits(packet,[{...corrected[0],path:'outside.js'}]),false);
 assert.match(visibleEditFeedback(packet,[{...corrected[0],path:'outside.js'}]),/not in the reader plan/);
});

test('overlapping high-scoring anchors do not consume the second source window',()=>{
 const left='<section id="videoGenerator">videoGenerator upload playback</section>\n';
 const right='<section id="audioReceiver">audioReceiver control</section>\n';
 const src=left+'neutral line\n'.repeat(2000)+right+'neutral tail\n'.repeat(2000);
 const packet=sourceWindows({'index.html':src},{task:'videoGenerator upload playback audioReceiver'});
 const w=packet.source['index.html'].windows;
 assert.equal(w.length,2);
 assert.ok(w.some(x=>x.text.includes('videoGenerator')));
 assert.ok(w.some(x=>x.text.includes('audioReceiver')));
 assert.ok(w[0].end<=w[1].start||w[1].end<=w[0].start);
 assert.ok(w.reduce((n,x)=>n+x.text.length,0)<=7000);
 assert.equal(checkVisibleEdits(packet,[{path:'index.html',before:right.trim(),after:'<section>Repaired</section>'}]),true);
 assert.equal(checkVisibleEdits(packet,[{path:'index.html',before:'neutral line\n'.repeat(500),after:'unshown'}]),false);
});


test('context replan hard-fails above 150 percent and preserves pinned digest and per-file budget',()=>{
 const src=('UIJobNotifier announceStart job listener\n'.repeat(70))+
  ('neutral component\n'.repeat(1100))+
  '<section id="notification-layout">UI job receipt</section>\n'+
  ('more neutral content\n'.repeat(300));
 const original={'bubbles-ai.js':src};
 const first=sourceWindows(original,{task:'UIJobNotifier announceStart'});
 assert.throws(()=>recalculateBounds(original,first,{expansionRatio:1.501}),/source_window_expansion_limit/);
 assert.throws(()=>recalculateBounds({'bubbles-ai.js':src+'malicious'},first),/source_replan_snapshot_mismatch/);
 const newPacket=recalculateBounds(original,first,{task:'notification-layout',attempt:1});
 assert.equal(newPacket.source['bubbles-ai.js'].sha256,sha256(src));
 assert.equal(newPacket.maximumChars,32000);
 assert.equal(newPacket.replanned,true);
 const oldLength=first.source['bubbles-ai.js'].windows.reduce((n,w)=>n+w.text.length,0);
 const total=newPacket.source['bubbles-ai.js'].windows.reduce((n,w)=>n+w.text.length,0);
 assert.ok(total<=Math.min(7000,Math.floor(oldLength*1.5)));
 assert.ok(total<=newPacket.maximumChars);
 assert.ok(newPacket.source['bubbles-ai.js'].windows.some(w=>w.text.includes('notification-layout')));
 assert.ok(newPacket.source['bubbles-ai.js'].windows.every(w=>w.text===src.slice(w.start,w.end)&&sha256(w.text)===w.sha256));
});
test('out-of-window Green before literal is not accepted until trusted context is recalculated',()=>{
 const distant='<aside class="brain-notice">Old status</aside>';
 const src=('function UIJobNotifier(){announceStart();}\n'.repeat(110))+
  ('unrelated source\n'.repeat(1600))+distant+'\n'+('trailing text\n'.repeat(140));
 const original={'bubbles-ai.js':src};
 const first=sourceWindows(original,{task:'UIJobNotifier'});
 const edit={path:'bubbles-ai.js',before:distant,after:distant.replace('Old status','Receipt verified')};
 assert.equal(checkVisibleEdits(first,[edit]),false);
 const shifted=recalculateBounds(original,first,{rejectedEdits:[edit],attempt:1});
 assert.equal(shifted.replanned,true);
 assert.equal(checkVisibleEdits(shifted,[edit]),true);
 assert.equal(checkVisibleEdits(shifted,[{...edit,path:'../wallet.js'}]),false);
});
test('source replan never invents missing paths, forged baselines or executable permissions',()=>{
 const original={'bubbles-ai.js':'start\n'.repeat(1500),'new.css':null};
 const first=sourceWindows(original,{task:'start'});
 const changed=recalculateBounds(original,first,{rejectedEdits:[{path:'wallet-secret.js',before:'not here',after:'oops'}]});
 assert.deepEqual(Object.keys(changed.source),Object.keys(first.source));
 assert.equal(changed.source['new.css'].kind,'new');
 assert.equal(checkVisibleEdits(changed,[{path:'wallet-secret.js',before:null,after:'oops'}]),false);
 const tampered=structuredClone(first);
 tampered.source['bubbles-ai.js'].windows[0].start+=1;
 assert.throws(()=>recalculateBounds(original,tampered),/source_replan_snapshot_mismatch/);
});

test('Green edit wrapper recovery requires exact visible source and keeps all gates',()=>{
 const pkt=sourceWindows({'bubbles-ai.js':'const ready = true;\nconst notReady = false;\n','new.js':null},{task:'ready'});
 const literal='const ready = true;';
 const wrapped=[{path:'bubbles-ai.js',before:{text:literal},after:'const ready = false;'}];
 assert.equal(checkVisibleEdits(pkt,wrapped),false);
 const normalized=normalizeVisibleEdits(pkt,wrapped);
 assert.equal(normalized[0].before,literal);
 assert.equal(checkVisibleEdits(pkt,normalized),true);
 assert.equal(typeof wrapped[0].before,'object');
 for(const before of [{text:'not-in-source'},{text:literal,regex:true},{value:literal},{text:''},null,42]){
  const bad=[{path:'bubbles-ai.js',before,after:'unsafe'}];
  assert.equal(checkVisibleEdits(pkt,normalizeVisibleEdits(pkt,bad)),false);
 }
 assert.equal(checkVisibleEdits(pkt,normalizeVisibleEdits(pkt,[{path:'outside.js',before:{text:literal},after:'unsafe'}])),false);
 assert.equal(checkVisibleEdits(pkt,normalizeVisibleEdits(pkt,[{path:'new.js',before:{text:literal},after:'unsafe'}])),false);
 const missing=visibleEditFeedback(pkt,[{path:'bubbles-ai.js',before:'not-shown',after:'ok'}]);
 assert.match(missing,/does not match any shown source window/);
 const objectFeedback=visibleEditFeedback(pkt,[{path:'bubbles-ai.js',before:{value:literal},after:'ok'}]);
 assert.match(objectFeedback,/plain JSON string/);
 assert.ok(!objectFeedback.includes(literal));
});
