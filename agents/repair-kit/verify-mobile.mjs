import fs from 'node:fs/promises';
const token=process.env.CF_BROWSER_TOKEN;
if(!token)throw Error('Cloudflare Browser runtime credential missing');
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/ef25728c096c6ba92cf510caa2058003/browser-rendering/scrape',{
 method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({url:'https://quantaphi.org/moltnook/',viewport:{width:360,height:800,isMobile:true,hasTouch:true},waitForSelector:{selector:'.mi-exchange',timeout:20000},elements:[{selector:'#mi-updated'},{selector:'.mi-exchange:first-child'}]})});
const data=await response.json();
const rows=data.result||[];
const valid=response.ok&&data.success&&rows.some(r=>r.selector==='.mi-exchange:first-child'&&r.results?.length);
await fs.writeFile('activity/mobile-verification.json',JSON.stringify({when:new Date().toISOString(),viewport:'360x800 Android',url:'https://quantaphi.org/moltnook/',passed:!!valid,evidence:data},null,2));
if(!valid)throw Error('Live Android feed verification failed');
console.log('Cloudflare browser confirmed a rendered evidence card at Android width');
