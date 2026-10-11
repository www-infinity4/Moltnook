import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {rewriteDeployedHTML,expectedEdgeVersion} from './repair-finalize-edge.mjs';
export async function browserCheck({content,sha,preview,prNumber}){
 const url='https://quantaphi.org/?repairCommit='+sha;
 const delivered=rewriteDeployedHTML(content);
 // Distinguish deployed source from a staged page. Never call a staged page deployed.
 if(!preview){
  let matched=false,diagnostic={};
  for(let i=0;i<6&&!matched;i++){
   const r=await fetch(url+'&attempt='+i,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   const actual=await r.text();
   diagnostic={status:r.status,edge:r.headers.get('x-quantaphi-edge'),expectedHash:crypto.createHash('sha256').update(delivered).digest('hex'),actualHash:crypto.createHash('sha256').update(actual).digest('hex')};
   matched=r.ok&&diagnostic.edge===expectedEdgeVersion&&actual===delivered;
   if(!matched&&i<5)await new Promise(resolve=>setTimeout(resolve,10000));
  }
  if(!matched)throw Error('Delivered HTML differs from pinned edge transform: '+JSON.stringify(diagnostic));
 }
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});
 const errors=[];let target;
 try{
  // No credentials, storage state, owner session, or runner tokens enter the browser.
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Read-only acceptance: prevent requests that could mutate backends.
  await context.route('**/*',async route=>{
   const request=route.request();
   if(!['GET','HEAD'].includes(request.method()))return route.abort();
   if(preview&&request.isNavigationRequest()&&request.frame()===page.mainFrame()&&new URL(request.url()).pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:delivered});
   return route.continue();
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  if(new URL(page.url()).origin!=='https://quantaphi.org')throw Error('Page left canonical origin');
  const link=page.locator('#shoplcShirtButton');await link.waitFor({state:'visible',timeout:30000});
  if(await link.count()!==1||await link.evaluate(el=>el.href)!=='https://quantaphi.org/shoplc/')throw Error('Live ShopLC control is wrong');
  const box=await link.boundingBox();if(!box||box.height<44||box.width<44)throw Error('ShopLC touch target is below 44px');
  await fs.mkdir('repository-receipts',{recursive:true});
  const screenshot='repository-receipts/shoplc-'+prNumber+'-'+(preview?'preview':'deployed')+'.png';
  await page.screenshot({path:screenshot,fullPage:true});
  // Exercise the real in-page viewer, not just a direct destination GET.
  await link.click();
  const viewer=page.locator('#siteViewer');await viewer.waitFor({state:'visible',timeout:15000});
  const frameElement=page.locator('#siteViewerFrame');
  if(await frameElement.getAttribute('src')!=='https://quantaphi.org/shoplc/')throw Error('ShopLC click opened the wrong embedded source');
  const handle=await frameElement.elementHandle();
  const frame=await handle?.contentFrame();if(!frame)throw Error('ShopLC embedded frame unavailable');
  await frame.waitForURL(u=>u.origin==='https://quantaphi.org'&&u.pathname==='/shoplc/',{waitUntil:'domcontentloaded',timeout:60000});
  target=frame.url();
  if(!await frame.locator('body').innerText())throw Error('ShopLC viewer is empty');
  await page.screenshot({path:'repository-receipts/shoplc-'+prNumber+'-'+(preview?'preview':'deployed')+'-opened.png',fullPage:true});
  await page.locator('#siteViewerClose').click();
  if(await viewer.isVisible())throw Error('ShopLC viewer failed to close');
  const response=await context.request.get('https://quantaphi.org/shoplc/',{maxRedirects:0,timeout:20000});
  if(!response.ok())throw Error('ShopLC destination HTTP failed');
  if(errors.length)throw Error('Browser JavaScript errors: '+errors.slice(0,3).join('; ').slice(0,250));
  return {passed:true,mode:preview?'staged_preview':'deployed',sha,edgeVersion:expectedEdgeVersion,viewport:'360x800',target,screenshot,checks:['canonical href','44px target','click opens correct viewer','viewer closes','destination loads','no page errors'],deployedFilesMatched:!preview};
 }finally{await browser.close();}
}
