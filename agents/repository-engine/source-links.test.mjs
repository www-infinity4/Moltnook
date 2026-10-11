import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLinkFacts} from './source-links.mjs';
test('ShopLC is read from the real anchor, not guessed from repetitive CSS or page introductions',async()=>{
 const html='shoplcShirtButton { color: red }\n'.repeat(6000)+'\n<section><a class="inPageSite" id="shoplcShirtButton" href="https://quantaphi.org/shoplc/" data-site-url="https://quantaphi.org/shoplc/" aria-label="Open ShopLC channel inside QuantaPhi"><span>ShopLC</span><small>Live channel</small></a></section>';
 const result=await collectLinkFacts({paths:['index.html'],task:'Fix shoplc button on quantaphi',read:async()=>html});
 assert.equal(result.length,1);assert.equal(result[0].label,'ShopLC Live channel');
 assert.equal(result[0].href,'https://quantaphi.org/shoplc/');
 assert.equal(result[0].id,'shoplcShirtButton');
 assert.equal(result[0].sourcePath,'index.html');
});
test('unsafe destinations and unrelated card labels never become evidence',async()=>{
 const html='<a href="javascript:alert(1)" id="shoplcBad">ShopLC</a><a href="https://example.org/clean">Unrelated</a><a href="/shoplc/">ShopLC in QuantaPhi</a>';
 const result=await collectLinkFacts({paths:['index.html','.github/workflows/worker.yml','../evil.html'],task:'Fix ShopLC button',read:async()=>html});
 assert.equal(result.length,1);assert.equal(result[0].href,'/shoplc/');
});
test('source facts are not live HTTP verification and empty evidence stays empty',async()=>{
 const r=await collectLinkFacts({paths:['index.html'],task:'A different obscure thing',read:async()=>'<a href="/shoplc/">ShopLC</a>'});
 assert.equal(r.length,0);
});
