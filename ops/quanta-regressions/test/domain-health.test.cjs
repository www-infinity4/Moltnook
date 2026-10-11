const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function run({origin='https://quantaphi.org',site=true,bridge='linked',credential=true,wallet=true}={}){
 const boxes=new Map(),calls=[];
 const document={readyState:'complete',getElementById:id=>boxes.get(id),createElement:()=>({setAttribute(){},style:{}}),querySelector:()=>({prepend:box=>boxes.set(box.id,box)})};
 const window={QuantaCloudConnection:{ready:Promise.resolve(),status:{bridge},hasCredential:()=>credential,authenticatedFetch:async url=>{calls.push(url);return {ok:wallet,json:async()=>({balances:{}})}}}};
 vm.runInNewContext(fs.readFileSync('domain-health.js','utf8'),{window,document,location:{origin},AbortSignal,fetch:async url=>{calls.push(url);return {ok:true,headers:{get:()=>site?'quantaphi-org-v16':null},json:async()=>({service:site?'quantaphi-site':'other',canonicalOrigin:'https://quantaphi.org',appPath:'/QuantaPhi/index.html'})}}});
 await new Promise(resolve=>setImmediate(resolve));
 return {status:window.QuantaDomainHealth,message:boxes.get('domainHealth')?.textContent,calls};
}
test('successful startup checks routing and reads wallet state once without a banner',async()=>{const r=await run();assert.equal(r.status.ledger,'ok');assert.equal(r.message,undefined);assert.deepEqual(r.calls,['/health','https://unified-wallet.marvaseater.workers.dev/v1/wallet/state'])});
test('routing and wallet failures remain diagnostic without adding a banner',async()=>{
 let r=await run({site:false});assert.equal(r.message,undefined);assert.equal(r.status.site,'unavailable');assert.equal(r.calls.length,1);
 r=await run({credential:false,bridge:'timeout'});assert.equal(r.message,undefined);assert.equal(r.status.ledger,'not-connected');assert.equal(r.calls.length,1);
 r=await run({wallet:false});assert.equal(r.message,undefined);assert.equal(r.status.ledger,'unavailable');
});
test('alternate addresses do not add a banner or request the ledger',async()=>{const r=await run({origin:'https://www-infinity4.github.io'});assert.equal(r.status.site,'alternate-origin');assert.equal(r.message,undefined);assert.equal(r.calls.length,0)});

test('QuantaPhi edge reads current main before a potentially stale Pages copy',async()=>{
 const requests=[],context={URL,URLSearchParams,Request,Response,Headers,AbortController,setTimeout,clearTimeout,fetch:async request=>{requests.push(String(request.url||request));return new Response('current source',{headers:{'content-type':'application/javascript'}})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('workers/quantaphi-site/worker.js','utf8').replace('export default','globalThis.worker='),context);
 const response=await context.worker.fetch(new Request('https://quantaphi.org/cloud-wallet-client.js'));
 assert.equal(response.status,200);assert.equal(await response.text(),'current source');
 assert.equal(requests.length,1);const source=new URL(requests[0]);assert.equal(source.origin,'https://raw.githubusercontent.com');assert.equal(source.pathname,'/www-infinity4/QuantaPhi/main/cloud-wallet-client.js');assert.ok(source.searchParams.get('__qpedge'));
});
