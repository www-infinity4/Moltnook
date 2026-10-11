const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const TOKEN='sq_'+'a'.repeat(40),PROOF='b'.repeat(64),profile={key:'kris',username:'kris',passwordHash:PROOF,tokens:14,pendingShareCredits:6,shareCount:146};
const storage=entries=>{const map=new Map(entries);return{map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size}}};
const session=JSON.stringify({key:'kris',username:'kris',signedInAt:Date.now()});
function oldOrigin(entries){
 const localStorage=storage(entries),nav=[];const html=fs.readFileSync('wallet-link.html','utf8');
 const scope={localStorage,URL,URLSearchParams,Date,Set,TextEncoder,btoa,console,location:{origin:'https://www-infinity4.github.io',search:'?mode=top&return='+encodeURIComponent('https://quantaphi.org/?q=alpha'),replace:u=>nav.push(u)},document:{getElementById:()=>({textContent:''})},window:{addEventListener(){}},setTimeout:fn=>fn()};
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],scope);
 return{localStorage,nav,hash:new URL(nav[0]).hash};
}
function destination(hash,entries=[],recoveryState=null){
 const localStorage=storage(entries),handlers=new Map(),requests=[],timers=[],nav=[];
 const document={body:{appendChild(){}},createElement:()=>({contentWindow:{postMessage(){}},remove(){}}),addEventListener:(n,f)=>{const a=handlers.get(n)||[];a.push(f);handlers.set(n,a)},dispatchEvent:e=>{for(const f of handlers.get(e.type)||[])f(e)}};
 const window={document,localStorage,crypto,STARQUEST_LEDGER_CONFIG:{endpoint:'https://starquest-ledger.marvaseater.workers.dev'},addEventListener(){},removeEventListener(){},dispatchEvent(){},clearTimeout(){},setTimeout:fn=>timers.push(fn)};
 const state=recoveryState||{username:'kris',starCoins:14,pendingShareCredits:6,shareCount:146,ledger:[{id:'cloud-receipt',type:'share',amount:1,balance:14,ts:Date.now()}],watchHistory:[]};
 window.fetch=async(url,options)=>{requests.push({url:String(url),options});if(String(url).includes('starquest-ledger.marvaseater.workers.dev/v1/state'))return{ok:Boolean(recoveryState),json:async()=>recoveryState?{ok:true,state:recoveryState}:{ok:false}};if(String(url).endsWith('/v1/bootstrap')){const body=JSON.parse(options.body);assert.equal(body.username,'kris');assert.equal(body.deviceToken,TOKEN);assert.equal(body.credentialProof,recoveryState?'':PROOF);return{ok:true,json:async()=>({ok:true,importedLocalState:false,state})}}assert.equal(options.headers.Authorization||options.headers.authorization,'Bearer '+TOKEN);return{ok:true,json:async()=>({balances:{INFINITY:229,QUANT:79},tokens:[{id:'saved-token'}]})}};
 const scope={window,document,localStorage,sessionStorage:storage([]),location:{origin:'https://quantaphi.org',href:'https://quantaphi.org/?q=alpha'+hash,hash,replace:u=>nav.push(u)},history:{replaceState(){}},crypto,AbortSignal,TextEncoder,TextDecoder,Uint8Array,atob,btoa,URL,URLSearchParams,Set,Date,console,fetch:window.fetch,setTimeout:fn=>timers.push(fn),clearTimeout(){},CustomEvent:class{constructor(type,opts={}){this.type=type;this.detail=opts.detail}},StorageEvent:class{}};
 vm.createContext(scope);vm.runInContext(fs.readFileSync(process.env.ACCOUNT_CLIENT_SOURCE||'cloud-wallet-client.js','utf8'),scope);
 vm.runInContext(fs.readFileSync('test/fixtures/starquest-auth.js','utf8'),scope);
 vm.runInContext(fs.readFileSync('test/fixtures/starquest-cloud-ledger.js','utf8'),scope);
 return{scope,window,localStorage,requests,nav,timers};
}
test('old-origin recovery survives the real Auth loader and reaches the real ledger bridge',async()=>{
 const old=oldOrigin([['starquest_session',session],['starquest_ledger_device_v1:kris',TOKEN],['starquest_users',JSON.stringify({kris:profile,other:{key:'other',password:'stay-private',passwordHash:'other-proof'}})]]);
 const transferred=JSON.parse(Buffer.from(new URLSearchParams(old.hash.slice(1)).get('quantaWalletLink'),'base64url').toString());
 assert.deepEqual(Object.keys(JSON.parse(transferred.values.starquest_users)),['kris']);assert.equal(JSON.stringify(transferred).includes('stay-private'),false);
 const f=destination(old.hash,[['starquest_users','{"other":{"key":"other","username":"other"}}'],['c13b0_infinity_token_ledger_v3','saved-history'],['quantaPhi:pendingSearchCommits:v2','saved-queue']]);
 assert.equal(f.window.StarQuestAuth.currentUser()?.key,'kris');
 assert.equal(await f.window.StarQuestCloudLedger.connect(),true);
 assert.equal(f.window.StarQuestAuth.getBalance(),14);
 assert.equal(f.window.StarQuestAuth.currentUser().pendingShareCredits,6);
 const response=await f.window.QuantaCloudConnection.authenticatedFetch('https://unified-wallet.marvaseater.workers.dev/v1/wallet/state');assert.deepEqual((await response.json()).balances,{INFINITY:229,QUANT:79});
 assert.equal(f.localStorage.getItem('c13b0_infinity_token_ledger_v3'),'saved-history');assert.equal(f.localStorage.getItem('quantaPhi:pendingSearchCommits:v2'),'saved-queue');assert.equal(JSON.parse(f.localStorage.getItem('starquest_users')).other.key,'other');
 assert.equal(f.requests.filter(x=>x.url.endsWith('/v1/bootstrap')).length,1);assert.equal(f.requests.some(x=>x.url.includes('/tokens/mint')),false);
});
test('a single existing credential recovers its account cache when the old session was cleared',async()=>{
 const old=oldOrigin([['starquest_ledger_device_v1:kris',TOKEN],['starquest_users_backup_v1',JSON.stringify({kris:profile})]]);
 const f=destination(old.hash);assert.equal(f.window.StarQuestAuth.currentUser()?.key,'kris');assert.equal(await f.window.StarQuestCloudLedger.connect(),true);
});
test('existing account history is preserved when importing the selected profile',()=>{
 const old=oldOrigin([['starquest_session',session],['starquest_ledger_device_v1:kris',TOKEN],['starquest_users',JSON.stringify({kris:profile})]]);
 const local={...profile,ledger:[{id:'local-receipt',type:'share',balance:14,ts:Date.now()}]};const f=destination(old.hash,[['starquest_users',JSON.stringify({kris:local})]]);
 assert.equal(f.window.StarQuestAuth.currentUser().ledger[0].id,'local-receipt');
});
test('a credential without its account record still requests recovery',async()=>{
 const f=destination('',[['starquest_ledger_device_v1:kris',TOKEN]]);f.scope.location.href='https://quantaphi.org/';f.timers[0]();await f.window.QuantaCloudConnection.ready;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.nav.length,1);assert.equal(new URL(f.nav[0]).pathname,'/__wallet-handoff');
});
test('the live gateway transfers an enrolled credential with or without its profile',async()=>{
 const context={URL,URLSearchParams,Request,Response,Headers,AbortController,setTimeout,clearTimeout,fetch:()=>{throw Error('unexpected upstream')}};vm.createContext(context);
 vm.runInContext(fs.readFileSync('workers/quantaphi-site/worker.js','utf8').replace('export default','globalThis.worker='),context);
 const html=await(await context.worker.fetch(new Request('https://quantaphi.org/__wallet-handoff?return='+encodeURIComponent('https://quantaphi.org/?q=alpha')))).text();
 for(const withProfile of [false,true]){
  const entries=[['starquest_session',session],['starquest_ledger_device_v1:kris',TOKEN]];if(withProfile)entries.push(['starquest_users',JSON.stringify({kris:profile})]);
  const nav=[],scope={localStorage:storage(entries),URL,URLSearchParams,TextEncoder,btoa,Date,location:{origin:'https://quantaphi.org',search:'?return='+encodeURIComponent('https://quantaphi.org/?q=alpha'),replace:u=>nav.push(u)},document:{body:{}}};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],scope);
  const target=new URL(nav[0]);assert.equal(target.origin,'https://quantaphi.org');
  const transferred=JSON.parse(Buffer.from(new URLSearchParams(target.hash.slice(1)).get('quantaWalletLink'),'base64url').toString());assert.equal(transferred.values['starquest_ledger_device_v1:kris'],TOKEN);
  if(withProfile){const payload=JSON.parse(Buffer.from(new URLSearchParams(target.hash.slice(1)).get('quantaWalletLink'),'base64url').toString());assert.equal(JSON.parse(payload.values.starquest_users).kris.passwordHash,PROOF)}else assert.equal(transferred.values.starquest_users,undefined);
 }
});

test('an enrolled token rebuilds its cloud profile without navigation or minting',async()=>{
 const f=destination('',[['starquest_ledger_device_v1:kris',TOKEN]],{username:'kris',starCoins:14,pendingShareCredits:6,shareCount:146,ledger:[{id:'saved'}],watchHistory:[]});
 f.scope.location.href='https://quantaphi.org/';f.timers[0]();await f.window.QuantaCloudConnection.ready;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.nav.length,0);assert.equal(f.window.QuantaCloudConnection.hasAccountProfile(),true);assert.equal(f.window.StarQuestAuth.currentUser()?.key,'kris');
 const profile=JSON.parse(f.localStorage.getItem('starquest_users')).kris;assert.equal(profile.tokens,14);assert.equal(profile.ledger[0].id,'saved');assert.equal(profile.passwordHash,'');
 assert.equal(f.requests.some(x=>/mint/.test(x.url)),false);
});
test('gateway with no enrolled credential still falls back to the legacy recovery page',async()=>{
 const context={URL,URLSearchParams,Request,Response,Headers,AbortController,setTimeout,clearTimeout,fetch:()=>{throw Error('unexpected upstream')}};vm.createContext(context);
 vm.runInContext(fs.readFileSync('workers/quantaphi-site/worker.js','utf8').replace('export default','globalThis.worker='),context);
 const html=await(await context.worker.fetch(new Request('https://quantaphi.org/__wallet-handoff?return='+encodeURIComponent('https://quantaphi.org/')))).text();const nav=[];
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{localStorage:storage([]),URL,URLSearchParams,TextEncoder,btoa,Date,location:{origin:'https://quantaphi.org',search:'?return='+encodeURIComponent('https://quantaphi.org/'),replace:u=>nav.push(u)},document:{body:{}}});
 const target=new URL(nav[0]);assert.equal(target.origin,'https://www-infinity4.github.io');assert.equal(target.pathname,'/QuantaPhi/wallet-link.html');assert.equal(target.searchParams.get('mode'),'top');
});
