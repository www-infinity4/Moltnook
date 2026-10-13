// Feature evidence feeds the existing browser-repair dispatcher. No model reply is proof of repair.
import fs from 'node:fs/promises';
export async function inspectServiceFeatures({launchBrowser}={}){
 const failures=[],records=[];let browser;
 try{
  const launch=launchBrowser|| (async()=>{const {chromium}=await import('playwright');return chromium.launch({headless:true})});
  browser=await launch();
  for(const spec of [
   {name:'Bubbles',path:'/bubbles/',repository:'www-infinity4/QuantaPhi',sourcePath:'bubbles-ai.js',selectors:['#bubblesAICard','.ba-launcher']},
   {name:'Code Phi image upload',path:'/omni-phi/code/',repository:'www-infinity4/Omni-Phi',sourcePath:'code/studio-tools.js',selectors:['#assetFile','#assetUse','#assetResult']},
   {name:'Moving video',path:'/video-studio.html',repository:'www-infinity4/QuantaPhi',sourcePath:'phi-imagine-video.js',selectors:['#phiVideoBuilder']}
  ]){
   const context=await browser.newContext({viewport:{width:360,height:800},permissions:[],serviceWorkers:'block'});
   const row={name:spec.name,url:'https://quantaphi.org'+spec.path,status:'unchecked'};records.push(row);
   try{
    await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
    const page=await context.newPage();await page.goto(row.url,{waitUntil:'domcontentloaded',timeout:25000});
    for(const selector of spec.selectors)await page.locator(selector).waitFor({state:'attached',timeout:10000});
    if(spec.name==='Moving video'){
     const response=await context.request.get('https://quantaphi.org/api/video/config');
     const config=await response.json();
     if(!response.ok()||(!(config.engines||[]).some(e=>e.ready)&&!config.configured))throw Error('No connected moving-video renderer. Configure an existing GPU host/workflow; source changes alone cannot supply GPU compute.');
    }
    row.status='controls_present';row.acceptance='Presence only; microphone hardware, uploads, AI output and authenticated repair execution need separate functional evidence.';
   }catch(error){row.status='failed';row.reason=String(error.message||error).slice(0,300);failures.push({repository:spec.repository,sourcePath:spec.sourcePath,selector:spec.selectors[0],device:'mobile',reason:row.reason})}
   finally{await context.close()}
  }
 }catch(error){failures.push({repository:'www-infinity4/QuantaPhi',reason:'Service browser unavailable: '+String(error.message||error).slice(0,200)})}
 finally{if(browser)await browser.close();await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/service-features.json',JSON.stringify({when:new Date().toISOString(),records,failures},null,2))}
 return failures;
}
