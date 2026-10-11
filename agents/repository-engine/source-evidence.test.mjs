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
