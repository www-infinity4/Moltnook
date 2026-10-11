import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {permittedLiveURL,selectLiveTargets,verifyLiveBrowser} from './live-browser.mjs';
test('browser navigation is restricted to anonymous first-party HTTPS',()=>{
 for(const url of ['http://quantaphi.org/','https://evil.com/','https://quantaphi.org.evil.com/','https://user:pass@quantaphi.org/','file:///etc/passwd','javascript:alert(1)','https://www.quantaphi.org/']){
  assert.equal(permittedLiveURL(url),'',url);
 }
 assert.equal(permittedLiveURL('https://quantaphi.org/shoplc/?v=123#details'),'https://quantaphi.org/shoplc/');
 assert.deepEqual(selectLiveTargets({repository:'www-infinity4/Other'}),[]);
 const targets=selectLiveTargets({repository:'www-infinity4/QuantaPhi',linkFacts:[
  {id:'shoplcShirtButton',href:'https://quantaphi.org/shoplc/',sourcePath:'index.html'},
  {id:'bad',href:'https://unrelated.example/pay',sourcePath:'index.html'},
  {id:'dup',href:'/shoplc/',sourcePath:'index.html'}
 ]});
 assert.equal(targets.length,2);
 assert.equal(targets[0].url,'https://quantaphi.org/');
 assert.equal(targets[1].url,'https://quantaphi.org/shoplc/');
});
function simulatedBrowser({status=200,short=false}={}){
 const calls={routes:[],closed:0,contexts:0,requested:[]};
 const browser={
  async newContext(){
   calls.contexts++;
   return {
    async route(_pattern,callback){calls.routes.push(callback)},
    async newPage(){let currentURL='';
     return {
      on(){},
      async goto(url){currentURL=url;calls.requested.push(url);return {status:()=>status}},
      async waitForTimeout(){},
      async evaluate(){return {title:'QuantaPhi',bodyChars:short?5:230,excerpt:'Public website',linkCount:5,buttonCount:3,horizontalOverflow:false,visibleImages:2}},
      async screenshot({path:file}){const data=Buffer.alloc(3500,7);await fs.writeFile(file,data);return data},
      url(){return currentURL}
     };
    },
    async close(){}
   };
  },
  async close(){calls.closed++}
 };
 return {browser,calls};
}
test('live page verifier checks mobile, desktop and linked target and saves real receipt paths',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'infinity-live-test-'));
 try{
  const {browser,calls}=simulatedBrowser();
  const r=await verifyLiveBrowser({repository:'www-infinity4/QuantaPhi',task:'ShopLC',linkFacts:[{id:'shoplcShirtButton',href:'/shoplc/',sourcePath:'index.html'}],directory,launchBrowser:async()=>browser});
  assert.equal(r.status,'public_browser_passed');
  assert.equal(r.browserPassed,true);
  assert.equal(r.deploymentVerified,false);
  assert.equal(r.featureAcceptance,false);
  assert.equal(r.targets.length,2);
  assert.equal(r.screenshots.length,3);
  assert.equal(calls.contexts,3);
  assert.equal(calls.closed,1);
  const route=calls.routes[0];
  let action='';
  await route({request:()=>({url:()=> 'https://evil.com/steal',method:()=> 'GET'}),abort:async()=>{action='blocked'},continue:async()=>{action='continued'}});
  assert.equal(action,'blocked');
  await route({request:()=>({url:()=> 'https://quantaphi.org/v1/mint',method:()=> 'POST'}),abort:async()=>{action='blocked'},continue:async()=>{action='continued'}});
  assert.equal(action,'blocked');
  await route({request:()=>({url:()=> 'https://quantaphi.org/assets/style.css',method:()=> 'GET'}),abort:async()=>{action='blocked'},continue:async()=>{action='continued'}});
  assert.equal(action,'continued');
  for(const screenshot of r.screenshots)assert.equal((await fs.stat(screenshot)).size,3500);
 }finally{await fs.rm(directory,{recursive:true,force:true})}
});
test('HTTP failure or weak body can never become browser verified',async()=>{
 for(const simulated of [{status:404},{short:true}]){
  const {browser}=simulatedBrowser(simulated);
  const report=await verifyLiveBrowser({repository:'www-infinity4/ShopLC',directory:await fs.mkdtemp(path.join(os.tmpdir(),'infinity-browser-negative-')),launchBrowser:async()=>browser});
  assert.equal(report.status,'public_browser_failed');
  assert.equal(report.browserPassed,false);
  assert.equal(report.deploymentVerified,false);
  await fs.rm(path.dirname(report.screenshots[0]),{recursive:true,force:true});
 }
});
