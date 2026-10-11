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
