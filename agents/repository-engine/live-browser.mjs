// Read-only mobile/desktop Playwright evidence of public Infinity websites.
// A healthy public URL is not proof that a candidate commit has deployed.
import fs from 'node:fs/promises';
import path from 'node:path';

const SITES=Object.freeze({
 'www-infinity4/QuantaPhi':'/',
 'www-infinity4/Omni-Phi':'/omni-phi/',
 'www-infinity4/C13b0':'/infinity-phi/',
 'www-infinity4/News-Phi':'/news-phi/',
 'www-infinity4/ShopLC':'/shoplc/',
 'www-infinity4/Moltnook':'/moltnook/',
 'www-infinity4/Oracle-Octaves':'/oracle-octaves/',
 'www-infinity4/Bitcoin-Crusher':'/bitcoin-crusher/'
});
const BASE='https://quantaphi.org';
export function permittedLiveURL(value){
 try{
  const u=new URL(String(value),BASE+'/');
  if(u.origin!==BASE||u.username||u.password||u.port||u.pathname.includes('..')||u.pathname.startsWith('//'))return '';
  if(u.search.length>400||u.hash.length>100)return '';
  u.hash='';u.search='';return u.href;
 }catch{return ''}
}
export function selectLiveTargets({repository,linkFacts=[],task=''}={}){
 const root=SITES[repository];if(!root)return [];
 const base=permittedLiveURL(BASE+root);
 const unique=new Set([base]);
 const links=Array.isArray(linkFacts)?linkFacts:[];
 const relevant=links.filter(row=>row&&typeof row==='object'&&/^[a-zA-Z0-9_-]{0,100}$/.test(String(row.id||'')));
 for(const row of relevant){
  const url=permittedLiveURL(row.siteUrl||row.href||'');
  if(url&&url!==base&&unique.size<4)unique.add(url);
 }
 return [...unique].map((url,index)=>({url,kind:index?'source-linked':'landing',source:index?relevant.find(x=>permittedLiveURL(x.siteUrl||x.href||'')===url)?.sourcePath||'':'route-registry'}));
}
function safeError(e){return String(e?.message||e||'unknown').replace(/(?:Bearer|token|apikey)\s*[:=]?\s*\S+/gi,'[redacted]').slice(0,220)}
export async function verifyLiveBrowser({repository,linkFacts=[],task='',directory='repository-receipts/live-browser',launchBrowser}={}){
 const targets=selectLiveTargets({repository,linkFacts,task});
 const report={schemaVersion:1,repository,checkedAt:new Date().toISOString(),mode:'live-public-readonly',
  status:'unsupported_route',browserPassed:false,featureAcceptance:false,deploymentVerified:false,
  networkPolicy:'quantaphi.org GET/HEAD only; anonymous clean storage; no clicks, POST, wallet, checkout or account actions',
  screenshots:[],targets:[],notes:['Public browser reachability does not prove a specific Git commit is deployed or validate authenticated transactions.']};
 if(!targets.length)return report;
 let browser;
 try{
  const launch=launchBrowser||async()=>{const {chromium}=await import('playwright');return chromium.launch({headless:true})};
  browser=await launch();
  for(const target of targets){
   const visit={url:target.url,kind:target.kind,source:target.source,views:[],errors:[]};
   report.targets.push(visit);
   for(const [device,viewport] of [['mobile',{width:360,height:800}],['desktop',{width:1280,height:800}]]){
    // Source-linked pages need one mobile check; root pages receive both viewports.
    if(target.kind==='source-linked'&&device==='desktop')continue;
    const context=await browser.newContext({viewport,serviceWorkers:'block',acceptDownloads:false,permissions:[],storageState:{cookies:[],origins:[]}});
    try{
     await context.route('**/*',route=>{
      const request=route.request(),url=permittedLiveURL(request.url());
      if(!url||!['GET','HEAD'].includes(request.method()))return route.abort('blockedbyclient');
      return route.continue();
     });
     const page=await context.newPage();
     page.on('popup',popup=>{void popup.close().catch(()=>{})});
     page.on('pageerror',error=>{if(visit.errors.length<6)visit.errors.push(device+': '+safeError(error))});
     const response=await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:16000});
     await page.waitForTimeout(600);
     const info=await page.evaluate(()=>{
      const body=document.body,html=document.documentElement;
      const text=(body?.innerText||'').replace(/\s+/g,' ').trim();
      const links=[...document.querySelectorAll('a[href]')];
      const buttons=[...document.querySelectorAll('button')];
      return {title:document.title.slice(0,140),bodyChars:text.length,
       excerpt:text.slice(0,240),linkCount:links.length,buttonCount:buttons.length,
       horizontalOverflow:html.scrollWidth>window.innerWidth+16,
       visibleImages:[...document.images].filter(x=>x.getBoundingClientRect().width>0).length};
     });
     const screenshot=path.join(directory,(target.kind==='landing'?'landing':'linked-'+report.targets.length)+'-'+device+'.png');
     await fs.mkdir(directory,{recursive:true});
     const buffer=await page.screenshot({path:screenshot,type:'png',fullPage:false,animations:'disabled',timeout:10000});
     const view={device,viewport:viewport.width+'x'+viewport.height,httpStatus:response?.status()||0,
      finalURL:permittedLiveURL(page.url())||'blocked-or-untrusted',...info,
      screenshotPath:screenshot,screenshotBytes:buffer.length};
     view.passed=view.httpStatus>=200&&view.httpStatus<400&&view.finalURL===target.url&&view.bodyChars>=30&&buffer.length>2000;
     visit.views.push(view);report.screenshots.push(screenshot);
    }catch(error){visit.views.push({device,passed:false,error:safeError(error)})}
    finally{await context.close()}
   }
  }
  report.browserPassed=report.targets.length>0&&report.targets.every(x=>x.views.length>0&&x.views.every(v=>v.passed));
  report.status=report.browserPassed?'public_browser_passed':'public_browser_failed';
 }catch(error){report.status='browser_unavailable';report.error=safeError(error)}
 finally{if(browser)await browser.close().catch(()=>{})}
 return report;
}
