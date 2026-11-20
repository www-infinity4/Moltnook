// Feature evidence feeds the existing browser-repair dispatcher.
// A missing optional renderer is an explicit external dependency, not a page
// regression or a video acceptance result. Actual broken APIs/controls still fail.
import fs from 'node:fs/promises';

export function classifyVideoRendererConfig(responseOk,config){
 if(!responseOk||!config||config.ok!==true||!Array.isArray(config.engines))
  return {status:'failed',videoVerified:false,reason:'Video configuration API failed or returned invalid data'};
 if(config.configured===true||config.engines.some(e=>e&&e.ready===true))
  return {status:'configured',videoVerified:false,reason:'Video provider reported configured; no actual rendered video verified'};
 return {status:'deferred_external_renderer',videoVerified:false,
  reason:'Moving-video renderer not connected; requires an authorized GPU host/workflow or optional Imagine provider credentials'};
}

async function saveReceipt(payload){
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/service-features.json',JSON.stringify(payload,null,2));
}

export async function inspectServiceFeatureReport({launchBrowser,writeReceipt=saveReceipt}={}){
 const failures=[],deferred=[],records=[];let browser;
 try{
  const launch=launchBrowser||(async()=>{const {chromium}=await import('playwright');return chromium.launch({headless:true})});
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
    if(spec.name==='Code Phi image upload'){
     await page.locator('#studioArtwork').click();
     await page.locator('#assetFile').setInputFiles({name:'service-fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMZkAAAAASUVORK5CYII=','base64')});
     await page.waitForFunction(()=>document.getElementById('assetResult')?.src.startsWith('data:image/')&&!document.getElementById('assetUse')?.disabled,{timeout:10000});
     row.uploadPreviewVerified=true;
    }
    if(spec.name==='Moving video'){
     const response=await context.request.get('https://quantaphi.org/api/video/config');
     const config=await response.json();
     const verdict=classifyVideoRendererConfig(response.ok(),config);
     row.videoVerified=false;
     if(verdict.status==='failed')throw Error(verdict.reason);
     if(verdict.status==='deferred_external_renderer'){
      row.status=verdict.status;row.reason=verdict.reason;
      deferred.push({repository:spec.repository,sourcePath:spec.sourcePath,
       selector:spec.selectors[0],device:'mobile',status:row.status,
       reason:row.reason,videoVerified:false});
      continue;
     }
    }
    row.status=row.uploadPreviewVerified?'upload_preview_passed':'controls_present';
    row.acceptance='Code upload uses a disposable local PNG; saved sites, microphone hardware, generated AI video and authenticated repair execution need separate evidence.';
   }catch(error){
    row.status='failed';row.reason=String(error.message||error).slice(0,300);
    failures.push({repository:spec.repository,sourcePath:spec.sourcePath,selector:spec.selectors[0],device:'mobile',reason:row.reason});
   }finally{await context.close()}
  }
 }catch(error){failures.push({repository:'www-infinity4/QuantaPhi',reason:'Service browser unavailable: '+String(error.message||error).slice(0,200)})}
 finally{
  if(browser)await browser.close();
  await writeReceipt({when:new Date().toISOString(),records,failures,deferred,
   videoAcceptanceVerified:false,note:'Unconnected optional provider is not page failure or a video-render receipt'});
 }
 return {failures,deferred,records};
}
// Preserve the original return contract for existing read-only consumers.
export async function inspectServiceFeatures(options){
 return (await inspectServiceFeatureReport(options)).failures;
}
