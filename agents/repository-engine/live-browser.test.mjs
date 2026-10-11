import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {permittedLiveURL,selectLiveTargets,verifyLiveBrowser,inspectSourceControls} from './live-browser.mjs';
test('CSS capitalization does not invent a changed label; real text and destination changes still fail',()=>{
 const oldDocument=globalThis.document,oldStyle=globalThis.getComputedStyle;
 let href='/shoplc/',label='Live channel';
 const el={nodeType:1,get childNodes(){return [{nodeType:3,nodeValue:'🌺 ShopLC'},{nodeType:1,childNodes:[{nodeType:3,nodeValue:label}]}]},innerText:'🌺 SHOPLC LIVE CHANNEL',getAttribute:()=>href,getBoundingClientRect:()=>({width:100,height:50})};
 globalThis.document={baseURI:'https://quantaphi.org/',getElementById:id=>id==='shoplcShirtButton'?el:null};
 globalThis.getComputedStyle=()=>({visibility:'visible',display:'block'});
 try{
  const rows=[{id:'shoplcShirtButton',href:'/shoplc/',label:'🌺 ShopLC Live channel'}];
  const result=inspectSourceControls(rows)[0];assert.equal(result.verified,true);assert.equal(result.renderedLabel,'🌺 SHOPLC LIVE CHANNEL');assert.equal(result.actualLabel,'🌺 ShopLC Live channel');
  label='Wrong channel';assert.equal(inspectSourceControls(rows)[0].labelMatches,false);
  label='Live channel';href='/wrong/';assert.equal(inspectSourceControls(rows)[0].hrefMatches,false);
  assert.equal(inspectSourceControls([{id:'missing',href:'/shoplc/'}])[0].verified,false);
 }finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=oldStyle}
});
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
function simulatedBrowser({status=200,short=false,controlMatched=true}={}){
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
      async evaluate(fn,rows){if(Array.isArray(rows))return rows.map(x=>({id:x.id,status:controlMatched?'matched':'mismatch',verified:controlMatched,visible:true,hrefMatches:controlMatched,labelMatches:controlMatched,actualLabel:x.label,actualHref:x.href}));return {title:'QuantaPhi',bodyChars:short?5:230,excerpt:'Public website',linkCount:5,buttonCount:3,horizontalOverflow:false,visibleImages:2}},
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

test('real DOM control evidence is separately tracked on both mobile and desktop without clicking',async()=>{
 for(const match of [true,false]){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'infinity-dom-control-'));
  try{
   const {browser}=simulatedBrowser({controlMatched:match});
   const report=await verifyLiveBrowser({repository:'www-infinity4/QuantaPhi',linkFacts:[{id:'shoplcShirtButton',href:'https://quantaphi.org/shoplc/',label:'ShopLC Live channel',sourcePath:'index.html'}],directory,launchBrowser:async()=>browser});
   assert.equal(report.browserPassed,true,'page health distinct from control verification');
   assert.equal(report.readOnlyControlChecks.length,2);
   assert.deepEqual(report.readOnlyControlChecks.map(x=>x.passed),[match,match]);
   assert.equal(report.targets[0].views[0].controlsChecked,1);
   assert.equal(report.targets[0].views[0].controlChecks[0].id,'shoplcShirtButton');
   assert.equal(report.featureAcceptance,false);
   assert.equal(report.deploymentVerified,false);
  }finally{await fs.rm(directory,{recursive:true,force:true})}
 }
});
