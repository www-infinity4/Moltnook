const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('// The deadline covers'),html.indexOf("$('#go').onclick=search;"));
function fixture({wallet='pending',retrieval='ok',aiBody='ok',ledgerUpdate='ok'}={}){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='#q'?'alpha':'',hidden:true,innerHTML:'',textContent:''});return nodes.get(id)};
 const minted=[],queued=[],confirmed=[],saved=[],requests=[],storage=new Map(),records=[];
 const pending=()=>new Promise(()=>{});
 const context={URL,URLSearchParams,AbortController,console:{warn(){}},Set,STOP:new Set(),crypto:{randomUUID:()=> 'same-search-id'},
 setTimeout:(fn,ms)=>setTimeout(fn,ms>=6500?15:ms),clearTimeout,
 $:node,history:{replaceState(){}},document:{getElementById:id=>node('#'+id)},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:()=>null,setItem(){}},
 CustomEvent:function(){},searchPermalink:()=> 'https://quantaphi.org/?q=alpha',elementIdentity:()=>null,normalizedEntity:q=>q,entityClause:q=>q,
 maybeRenderStockWidget(){},monitorLifecycleStart(){},showField(){},loadMedia(){},classify:q=>[{w:q}],quantaAiUserId:()=> 'test',
 aiPayloadText:d=>d.text,parseOverviewSections:t=>({red:{overview:t}}),overviewProse:t=>t,renderFivePartOverview:s=>s.red.overview,
 activateFivePartOverview(){},monitorRendered(){},loadExpandedDataIndex(){},loadHistoryAssimilation(){},
 buildStructuredEvidenceFallback:()=>({red:{overview:'Source overview'}}),fallbackResearch:async()=>({results:[{title:'alpha source',url:'https://example.test/alpha',content:'alpha evidence'}]}),
 QuantaUnifiedTokenLedger:{load:async()=>records,create:async q=>{minted.push(q);const t={id:'local-id',createdAt:'2026-10-04'};records.push(t);return t},update:async()=>ledgerUpdate==='stalled'?pending():undefined,website:()=>'',finalize:async(id,q,s)=>saved.push(s.red.overview)},
 fetch:async url=>{requests.push(String(url));if(String(url).includes('/search')){if(retrieval==='failed')throw Error('retrieval failed');return{ok:true,json:async()=>({results:[{title:'alpha source',content:'alpha evidence',url:'https://example.test/alpha'}]})}}return{ok:true,json:aiBody==='stalled'?pending:async()=>({text:'AI overview'})}}
 };
 context.window={dispatchEvent(){},QuantaResearch:{},QuantaCloudConnection:{ready:pending(),authenticatedFetch:async()=>wallet==='body'?{ok:true,json:pending}:pending()},
 QuantaInfinityCredit:{enqueue:(q,id)=>queued.push(id),enqueueSearch:(q,id)=>queued.push(id),confirm:async id=>confirmed.push(id)}};
 vm.createContext(context);vm.runInContext(code+'\nglobalThis.runSearch=search;',context);
 return{context,node,minted,queued,confirmed,saved,requests,records};
}
for(const wallet of ['pending','body'])test('overview completes when wallet '+wallet+' never resolves and research-trail helper is absent',async()=>{
 const f=fixture({wallet});await f.context.runSearch();assert.equal(f.node('#overview').innerHTML,'AI overview');assert.deepEqual(f.minted,['alpha']);assert.deepEqual(f.queued,['samesearchid']);assert.equal(f.requests.some(x=>x.includes('/v1/chat')),true);
 await f.context.runSearch({restore:true,tokenId:'local-id'});assert.equal(f.minted.length,1);assert.equal(f.queued.length,1);
 await new Promise(resolve=>setTimeout(resolve,25));assert.equal(f.node('#overview').innerHTML,'AI overview');
});
test('retrieval failure still supplies fallback evidence to the overview',async()=>{const f=fixture({retrieval:'failed'});await f.context.runSearch();assert.equal(f.node('#overview').innerHTML,'AI overview');assert.equal(f.requests.some(x=>x.includes('/v1/chat')),true)});
test('AI JSON body timeout reaches a source overview instead of Building forever',async()=>{const f=fixture({aiBody:'stalled'});await f.context.runSearch();assert.equal(f.node('#overview').innerHTML,'Source overview');assert.equal(f.saved.length,1)});
test('deadline includes a response body whose headers already arrived',async()=>{const f=fixture();let signal;await assert.rejects(f.context.boundedJsonRequest(s=>{signal=s;return{json:()=>new Promise(()=>{})}},5),/timed out/);assert.equal(signal.aborted,true)});

test('stalled local ledger update cannot hold the overview at Building',async()=>{const f=fixture({ledgerUpdate:'stalled'});await f.context.runSearch();assert.equal(f.node('#overview').innerHTML,'AI overview');assert.equal(f.requests.some(x=>x.includes('/v1/chat')),true)});
