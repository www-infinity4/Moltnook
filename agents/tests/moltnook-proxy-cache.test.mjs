import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../workers/moltnook-proxy.js',import.meta.url),'utf8');
async function serve(path){
 let handler,options,url;
 const context={addEventListener:(event,fn)=>{if(event==='fetch')handler=fn},URL,Request,Response,Headers,AbortSignal,
 fetch:async(href,opt)=>{url=href;options=opt;return new Response('verified',{status:200,headers:{'Content-Type':'text/html','Set-Cookie':'never-forward'}})}};
 vm.runInNewContext(script,context);
 let answer;handler({request:new Request('https://quantaphi.org'+path),respondWith:p=>{answer=p}});
 return {response:await answer,options,url};
}
test('public static Moltnook HTML has bounded edge cache instead of cache-busting every request',async()=>{
 const a=await serve('/moltnook/'),b=await serve('/moltnook/');
 assert.equal(a.url,b.url);
 assert.doesNotMatch(a.url,/moltnookFresh|Date\.now/);
 assert.match(a.response.headers.get('cache-control'),/public.*max-age=60/);
 assert.equal(a.options.cf.cacheEverything,true);
 assert.equal(a.options.cf.cacheTtl,60);
 assert.equal(a.response.headers.get('set-cookie'),null);
});
test('live agent evidence stays fresher than compiled JavaScript but is not permanently uncached',async()=>{
 const activity=await serve('/moltnook/activity/iterations.json');
 const scriptFile=await serve('/moltnook/agent-room.js');
 assert.equal(activity.options.cf.cacheTtl,15);
 assert.equal(scriptFile.options.cf.cacheTtl,600);
 assert.match(activity.response.headers.get('cache-control'),/max-age=15/);
});
