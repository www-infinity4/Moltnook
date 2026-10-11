import fs from 'node:fs/promises';
export async function browserCheck({content,sha,preview,prNumber}){
 const url='https://quantaphi.org/?repairCommit='+sha;
 // Distinguish deployed source from a staged page. Never call a staged page deployed.
 if(!preview){
  let matched=false;
  for(let i=0;i<6&&!matched;i++){
   const r=await fetch(url+'&attempt='+i,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   matched=r.ok&&(await r.text())===content;
   if(!matched&&i<5)await new Promise(resolve=>setTimeout(resolve,10000));
  }
  if(!matched)throw Error('Merged HTML has not reached quantaphi.org');
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
   if(preview&&request.isNavigationRequest()&&request.frame()===page.mainFrame()&&new URL(request.url()).pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:content});
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
  const response=await page.goto('https://quantaphi.org/shoplc/',{waitUntil:'domcontentloaded',timeout:60000});
  target=page.url();if(!response?.ok()||new URL(target).origin!=='https://quantaphi.org'||new URL(target).pathname!=='/shoplc/')throw Error('ShopLC destination failed or redirected');
  if(errors.length)throw Error('Browser JavaScript errors: '+errors.slice(0,3).join('; ').slice(0,250));
  return {passed:true,mode:preview?'staged_preview':'deployed',sha,viewport:'360x800',target,screenshot,checks:['canonical href','44px target','destination loads','no page errors'],deployedFilesMatched:!preview};
 }finally{await browser.close();}
}
