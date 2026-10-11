const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(){const values=new Map([['quantaPhiTokens','79']]);const context={localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},window:{addEventListener(){},dispatchEvent(){}},CustomEvent:class{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../asset-balances.js'),'utf8'),context);return context.window.PhiAssetBalances}
test('a stale pre-mint balance cannot turn Quant 80 back into 79',()=>{const a=fixture(),read=a.beginRead('QUANT');a.mint('QUANT','oranges');assert.equal(a.value('QUANT'),80);assert.equal(a.accept('QUANT',79,read),false);a.confirm('QUANT','oranges');assert.equal(a.value('QUANT'),80);assert.equal(a.accept('QUANT',79,read),false)});
test('a new spend snapshot lowers only the asset spent',()=>{const a=fixture();a.seed('INFINITY',98);a.accept('QUANT',75,a.beginRead('QUANT'));assert.equal(a.value('QUANT'),75);assert.equal(a.value('INFINITY'),98)});
test('a pending mint is not counted twice when a cloud snapshot already includes it',()=>{const a=fixture();a.mint('QUANT','oranges');assert.equal(a.accept('QUANT',80,a.beginRead('QUANT')),false);assert.equal(a.value('QUANT'),80);a.confirm('QUANT','oranges',80);assert.equal(a.value('QUANT'),80)});
test('music count merges IndexedDB with both histories, deduplicates and excludes transfers',async()=>{const values=new Map([['musicPhi:quants:v1',JSON.stringify([{id:'piano1'},{id:'gone',transferredAt:'2026-10-03'}])],['musicPhi:listeningQuants:v1',JSON.stringify([{id:'listen1',kind:'listening'}])]]);const context={window:{MusicQuantStore:{list:async()=>[{id:'piano1'},{id:'piano2'}]},ControlPhi:{refreshWallet(){}},dispatchEvent(){}},document:{readyState:'complete',addEventListener(){}},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},addEventListener(){},setInterval(){},console,CustomEvent:class{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../music-quant-cloud.js'),'utf8'),context);await new Promise(r=>setImmediate(r));assert.equal(context.window.MusicQuantCloud.localCount,3);assert.equal(context.window.MusicQuantCloud.pianoCount,2);assert.equal(context.window.MusicQuantCloud.listeningCount,1)});
test('Infinity source split includes Quanta websites but never Music Quants',()=>{const code=fs.readFileSync(path.join(__dirname,'../wallet-runtime.js'),'utf8'),start=code.indexOf('  function canonicalSearchCounts(){'),end=code.indexOf('  let cloudBalances={};',start);const values=new Map([['c13b0_infinity_token_ledger_v3',JSON.stringify([{id:'phi-1',source:'infinity-phi'},{id:'omni-1',source:'omni-phi'},{id:'quant-1',source:'quanta-phi',sourceEventId:'search-1'}])],['infinity_unified_wallet_v1',JSON.stringify({tokens:{music:{id:'mq_1',type:'MUSIC_QUANT',source:'Infinity Radio'},pair:{id:'paired-infinity',type:'INFINITY_SEARCH_TOKEN',source:'QUANTAPHI',sourceEventId:'search-1'}}})]]);const context={clean:(s)=>String(s||''),decodeInfinityEnvelope:JSON.parse,read:(key,f)=>{try{return JSON.parse(values.get(key)||'null')??f}catch{return f}},localStorage:{getItem:key=>values.get(key)},WALLET_SESSION_KEY:'session',WALLET_USERS_KEY:'users',WALLET_GUEST_KEY:'guest'};vm.runInNewContext(code.slice(start,end)+'result=canonicalSearchCounts()',context);assert.equal(context.result.total,3);assert.equal(context.result.infinity,1);assert.equal(context.result.omni,1);assert.equal(context.result.quants,1)});

test('Quanta search retry targets the authoritative paired D1 commit, not a second browser-side Infinity mint',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../search-wallet-sync.js'),'utf8');
  assert.match(code,/quanta-phi-ledger[^']*\/v1\/quants\/search/);
  assert.doesNotMatch(code,/\/v1\/tokens\/mint/);
  assert.doesNotMatch(code,/unified-wallet\.marvaseater\.workers\.dev/);
});

test('initial search ledger commit is wired before the AI overview request',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const ledger=code.indexOf("window.QuantaInfinityCredit.commitNow(nq,searchId,createdAt,q)");
  const overview=code.indexOf("/v1/chat",ledger);
  assert.ok(ledger>=0&&overview>=0&&ledger<overview);
  assert.match(fs.readFileSync('search-wallet-sync.js','utf8'),/credit_query/);
  assert.match(code,/\/v1\/quants\/history-import/);
  assert.match(code,/\/v1\/quants\/infinity-legacy-balance/);
});

test('server search commit journals the search and pairs Quant with Infinity history',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../workers/quanta-phi-ledger/worker.js'),'utf8');
  assert.match(code,/quanta_search_journal/);
  assert.match(code,/search_commit_pending/);
  assert.match(code,/token_type,source,data_json,provenance_hash/);
  assert.match(code,/asset_code,event_type,amount,balance_after/);
  assert.match(code,/history-import/);
  assert.match(code,/amount <= before/);
  assert.match(code,/infinity_balance<\?/);
  assert.doesNotMatch(code,/cloud_history_already_authoritative/);
  assert.match(code,/historyId\.startsWith\("archive:"\)/);
});
test('offline searches create durable drafts but do not invent owned Infinity credits',async()=>{const s=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),start=s.indexOf(' async function create(q){'),end=s.indexOf('\n function payload',start),a=fixture();let records=[];const context={window:{PhiAssetBalances:a},website:(id,q)=>'https://example.test/'+id,load:async()=>records,save:async all=>{records=all},mutate:async fn=>{fn(records);return records},Date,Math};vm.runInNewContext(s.slice(start,end)+'globalThis.createToken=create',context);await context.createToken('oranges');await context.createToken('tech');assert.equal(a.value('INFINITY'),0);assert.equal(records.length,2);assert.ok(records.every(x=>x.cloudStatus==='pending'))});


test('authoritative Cloudflare state clears speculative pending balances',()=>{const a=fixture();a.mint('QUANT','stale-search');assert.equal(a.value('QUANT'),80);a.authoritative('QUANT',79);assert.equal(a.value('QUANT'),79);assert.equal(a.snapshot().QUANT.pending,0);assert.equal(a.snapshot().QUANT.cloud,true)});
test('initial search does not call the browser-side Quant mint helper',()=>{const code=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),start=code.indexOf('async function search(options={})'),end=code.indexOf("$('#go').onclick=search",start),search=code.slice(start,end);assert.doesNotMatch(search,/QuantaPhiWallet\?\.addToken/);assert.match(code,/quantaPhiOwnedInfinityMigratedV5:/);assert.match(code,/quantaPhiD1HistoryRecoveredV4:/);assert.match(code,/quantaPhiLegacyRecoveredV2:/)});
test('authoritative Quanta state returns paired Infinity balance too',()=>{const code=fs.readFileSync(path.join(__dirname,'../workers/quanta-phi-ledger/worker.js'),'utf8'),start=code.indexOf('if (url.pathname === "/v1/quants/state"'),end=code.indexOf('if (url.pathname === "/v1/quants/transfer"',start),state=code.slice(start,end);assert.match(state,/user_id:\s*identity\.user_id/);assert.match(state,/infinity_balance/);assert.match(state,/unified_wallet_state/)});

test('refresh restore reuses saved search history before any new mint path',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const start=code.indexOf('async function search(options={})');
  const end=code.indexOf("$('#go').onclick=search",start);
  const search=code.slice(start,end);
  assert.match(search,/let refining=options\.refine===true\|\|options\.restore===true/);
  assert.match(search,/if\(options\.restore\)[\s\S]*quantaPhiBuildHistoryV1[\s\S]*token_id[\s\S]*refining=true/);
  assert.match(search,/if\(!refining&&!searchId\)[\s\S]*crypto\.randomUUID/);
  assert.match(search,/if\(searchId&&!refining\)[\s\S]*QuantaInfinityCredit\.commitNow/);
});


test('StarCoin receipt queue falls back when Web Crypto subtle is unavailable',async()=>{
  const code=fs.readFileSync(path.join(__dirname,'../wallet-runtime.js'),'utf8');
  const start=code.indexOf("  const REWARD_QUEUE='phi:pendingStarCoinReceipts:v1';");
  const end=code.indexOf('  async function flushStarReceipts(){',start);
  const values=new Map();
  const context={
    crypto:{randomUUID:()=> 'id-only'},
    globalThis:null,
    TextEncoder:undefined,
    read:(key,f)=>{try{return JSON.parse(values.get(key)||'null')??f}catch{return f}},
    write:(key,value)=>{values.set(key,JSON.stringify(value));return true},
    flushStarReceipts(){},
    console:{warn(){}}
  };
  context.globalThis=context;
  vm.runInNewContext(code.slice(start,end)+';globalThis.queueStarReceipt=queueStarReceipt;',context);
  const ok=await context.queueStarReceipt('share-123','https://quantaphi.org/story','web_share_api');
  assert.equal(ok,true);
  const queued=JSON.parse(values.get('phi:pendingStarCoinReceipts:v1'));
  assert.equal(queued.length,1);
  assert.match(queued[0].attemptId,/^phi-reward:fnv1a-[0-9a-f]{8}$/);
});


test('pending search queue preserves a backup when primary storage write fails',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../search-wallet-sync.js'),'utf8');
  const values=new Map(),listeners={};
  const localStorage={
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>{if(key==='quantaPhi:pendingSearchCommits:v2')throw new Error('quota');values.set(key,String(value))},
    removeItem:key=>values.delete(key)
  };
  const window={localStorage,addEventListener:(name,fn)=>{listeners[name]=fn},setInterval(){},QuantaCloudConnection:null};
  const document={addEventListener(){}};
  const context={window,document,localStorage,console,CustomEvent:class{},Event:class{},setInterval(){},setTimeout,clearTimeout,AbortSignal};
  vm.runInNewContext(code,context);
  assert.equal(window.QuantaInfinityCredit.enqueueSearch('alpha','search-1','2026-10-04T00:00:00.000Z'),true);
  const backup=JSON.parse(values.get('quantaPhi:pendingSearchCommits:backup:v1'));
  assert.equal(backup.length,1);
  assert.equal(backup[0].search_id,'search-1');
  assert.equal(window.QuantaInfinityCredit.pending()[0].search_id,'search-1');
});


test('legacy Quant recovery is a monotonic total-balance floor, not an additive duplicate',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../workers/quanta-phi-ledger/worker.js'),'utf8');
  const start=code.indexOf('if (url.pathname === "/v1/quants/legacy-migrate"');
  const end=code.indexOf('if (url.pathname === "/v1/quants/receive"',start);
  const route=code.slice(start,end);
  assert.match(route,/SUM\(delta\)/);
  assert.match(route,/targetBalance <= currentBalance/);
  assert.match(route,/targetBalance - currentBalance/);
  assert.match(route,/INSERT OR IGNORE INTO quant_recovery_adjustments/);
});
test('Infinity recovery can raise an earlier low cloud floor but never lower it',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../workers/quanta-phi-ledger/worker.js'),'utf8');
  const start=code.indexOf('if (url.pathname === "/v1/quants/infinity-legacy-balance"');
  const end=code.indexOf('if (url.pathname === "/v1/quants/history-import"',start);
  const route=code.slice(start,end);
  assert.match(route,/amount <= before/);
  assert.match(route,/legacy-infinity-floor:/);
  assert.match(route,/infinity_balance<\?/);
});
test('wallet sync de-duplicates overlapping load focus and auth refreshes',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(code,/let syncFlight=null/);
  assert.match(code,/if\(syncFlight\)return syncFlight/);
});


test('QuantaPhi search uses the single retryable paired cloud commit path',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(code,/QuantaInfinityCredit\.commitNow\(nq,searchId,createdAt,q\)/);
  assert.doesNotMatch(code,/if\(bridge\?\.authenticatedFetch\)void \(async/);
  assert.match(code,/search-wallet-sync\.js\?v=[A-Za-z0-9-]+/);
});
test('wallet client resolves ambiguous saved device tokens against cloud ownership',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../cloud-wallet-client.js'),'utf8');
  assert.match(code,/async function resolveDeviceToken\(\)/);
  assert.match(code,/payload\.state\.username/);
  assert.match(code,/recoverAccountProfileFromDevice/);
});
test('old-origin handoff passes valid device credentials when no session selects one',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../wallet-link.html'),'utf8');
  assert.match(code,/const selected=username\?deviceKeys\.filter\(key=>key===DEVICE_PREFIX\+username\):deviceKeys;/);
});
