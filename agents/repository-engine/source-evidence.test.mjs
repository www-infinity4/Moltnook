import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSourceEvidence} from './source-evidence.mjs';
test('planner sees the actual shop link before claiming source URLs are missing',async()=>{
 const seen=[],samples={'index.html':'<a href="/shop/buy">Shop now</a>\n<a href="/news">News</a>','src/shop.js':'export const shopDestination="/shop/buy";\nconst next="https://quantaphi.org/shop/";','README.md':'Site overview'};
 const result=await collectSourceEvidence({paths:['.env','dist/bundle.js','README.md','index.html','src/shop.js'],task:'Fix broken shop link and check intended destination',read:async path=>{seen.push(path);return samples[path]}});
 assert.match(JSON.stringify(result),/\/shop\/buy/);assert.ok(!seen.includes('.env'));assert.ok(!seen.includes('dist/bundle.js'));
});
test('source evidence is bounded and redacts credential-bearing lines',async()=>{
 const result=await collectSourceEvidence({paths:['index.html'],task:'Check shop',read:async()=>'<a href="/shop">Shop</a>\nAPI_KEY="very-private-secret"\n'+('shop content '.repeat(1000)),maxChars:1000});
 const s=JSON.stringify(result);assert.ok(s.length<1400);assert.ok(!s.includes('very-private-secret'));
});

test('ShopLC button near the end of a large QuantaPhi page is still inspectable',async()=>{
  const big='Unrelated research cards. '.repeat(11000)+'\n<a class="shoplcShirtButton" id="shoplcShirtButton" href="https://quantaphi.org/shoplc/" aria-label="Open ShopLC channel inside QuantaPhi">ShopLC Live channel</a>';
  assert.ok(big.length>180000);
  const snippets=await collectSourceEvidence({paths:['index.html'],task:'Fix shoplc button on quantaphi',read:async()=>big,maxChars:4000});
  assert.match(snippets['index.html'],/shoplcShirtButton/);
  assert.match(snippets['index.html'],/https:\/\/quantaphi\.org\/shoplc\//);
  assert.ok(snippets['index.html'].length<=3200);
});

test('Robot chooses the actual ShopLC anchor after dozens of unrelated links',async()=>{
 const links=Array.from({length:100},(_,i)=>'<a href="https://example.org/article-'+i+'">Research link '+i+'</a>').join('\n');
 const page=links+'\n<a id="shoplcShirtButton" class="inPageSite" href="https://quantaphi.org/shoplc/" data-site-title="ShopLC Channel">ShopLC Live channel</a>';
 const samples=await collectSourceEvidence({paths:['index.html'],task:'Fix broken shop link in QuantaPhi application',read:async()=>page});
 assert.match(samples['index.html'],/shoplcShirtButton/);
 assert.match(samples['index.html'],/quantaphi\.org\/shoplc/);
 assert.ok(samples['index.html'].length<=3200);
});

test('named Android classes outrank generic web entrypoints and expose method context',async()=>{
 const java='android/app/src/main/java/org/example/BrainLearningService.java';
 const files=Object.fromEntries(Array.from({length:20},(_,i)=>['pages/'+i+'/index.html','<p>Web page</p>']));
 files[java]='package org.example;\npublic class BrainLearningService {\n  void onJobClaim() {\n    announceStarted();\n  }\n}\n';
 const result=await collectSourceEvidence({paths:Object.keys(files),task:'Find BrainLearningService onJobClaim for the Android job notification',read:async path=>files[path]});
 assert.ok(Object.hasOwn(result,java));assert.match(result[java],/void onJobClaim/);assert.match(result[java],/announceStarted/);
 assert.ok(Object.keys(result).length<=9);assert.ok(Object.values(result).join('').length<=16000);
});
test('Android Kotlin and manifest source are readable while generated and secret inputs stay excluded',async()=>{
 const files={'android/app/src/main/java/VoiceBridge.kt':'class VoiceBridge { fun drainNativeReply() {} }','android/app/src/main/AndroidManifest.xml':'<manifest><application /></manifest>','android/app/build/generated/Generated.java':'private generated source','android/secrets/key.kt':'private credential source'};
 const seen=[];const result=await collectSourceEvidence({paths:Object.keys(files),task:'Inspect VoiceBridge drainNativeReply and AndroidManifest',read:async path=>{seen.push(path);return files[path];}});
 assert.match(JSON.stringify(result),/drainNativeReply/);assert.match(JSON.stringify(result),/<manifest>/);
 assert.ok(!seen.some(p=>p.includes('/generated/')||p.includes('/secrets/')));
});
test('late named bridge symbols are found in source without asking the owner for file paths',async()=>{
 const files=Object.fromEntries(Array.from({length:25},(_,i)=>['pages/'+i+'/index.html','<p>Owner job notifications</p>']));
 files['android/app/src/main/java/VoiceWindow.java']='class VoiceWindow {\n void poll() {\n   browser.evaluateJavascript("window.QuantaBubbles.drainNativeReply()", callback);\n }\n}';
 const reads=[];const result=await collectSourceEvidence({paths:Object.keys(files),task:('ordinary owner job requirements ').repeat(100)+' Inspect drainNativeReply in Android.',read:async path=>{reads.push(path);return files[path];}});
 assert.match(result['android/app/src/main/java/VoiceWindow.java'],/drainNativeReply/);
 assert.ok(reads.length<=48);assert.ok(Object.keys(result).length<=9);
});
