import path from 'node:path';
import {execFileSync} from 'node:child_process';
export async function captureSourceViews({workspace,repository,baseSha,commitSha,paths,entry='index.html',summary,jobId}){
 if(!/^[\w./-]+\.html$/.test(entry)||entry.includes('..'))throw Error('No static-page preview adapter for this entry');
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});const images={};
 const read=(ref,p)=>execFileSync('git',['show',ref+':'+p],{cwd:workspace,encoding:'utf8',maxBuffer:3*1024*1024});
 try{for(const [side,ref]of [['before',baseSha],['after',commitSha]]){
  const context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:'block'});
  try{
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!=='https://preview.invalid'||route.request().method()!=='GET')return route.fulfill({status:503,body:'Service disconnected in immutable source preview'});
    let p;try{p=decodeURIComponent(url.pathname).slice(1)||entry;}catch{return route.fulfill({status:400,body:'Invalid path'})}
    if(p.includes('..')||p.startsWith('.git')||p.startsWith('.env'))return route.fulfill({status:404,body:''});
    try{const body=read(ref,p);return route.fulfill({body,contentType:p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':/\.(?:js|mjs)$/.test(p)?'application/javascript':'text/plain'});}catch{return route.fulfill({status:404,body:''})}
   });
   const page=await context.newPage();await page.goto('https://preview.invalid/'+entry,{waitUntil:'networkidle'});
   const text=(await page.locator('body').innerText()).trim();if(text.length<20)throw Error('Page needs its framework build-preview adapter; refusing to publish an empty view');
   await page.evaluate(()=>{document.querySelectorAll('*').forEach(e=>{e.style.animation='none';e.style.transition='none'})});
   const height=Math.min(2400,Math.max(300,await page.evaluate(()=>document.documentElement.scrollHeight)));
   let image;for(const quality of [65,45,25]){image=await page.screenshot({type:'jpeg',quality,clip:{x:0,y:0,width:360,height}});if(image.length<=44000)break;}
   if(image.length>44000)throw Error('Rendered page exceeds image storage bound');images[side]='data:image/jpeg;base64,'+image.toString('base64');
  }finally{await context.close()}
 }}finally{await browser.close()}
 return {schemaVersion:1,repository,baseSha,commitSha,paths,summary:summary.slice(0,500),jobId,status:'source_preview',when:new Date().toISOString(),viewport:'360x800',renderMode:'isolated-static-source',note:'Exact committed HTML rendered with network services disconnected. This is source evidence; deployment and runtime acceptance are separate.',...images};
}
