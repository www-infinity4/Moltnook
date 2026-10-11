const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(entries){let calls=[];const map=new Map(entries),window={StarQuestCloudLedger:{authenticatedFetch:async()=>{throw Error('ledger_not_connected')}}};const localStorage={getItem:k=>map.get(k)||null,key:i=>[...map.keys()][i],get length(){return map.size}};vm.runInNewContext(fs.readFileSync('cloud-wallet-client.js','utf8'),{window,localStorage,location:{origin:"https://www-infinity4.github.io"},URL,fetch:async(url,opts)=>{calls.push({url,opts});return {ok:true}},Set});return {window,calls}}
test('expired session can use its single existing device credential for the paired commit',async()=>{const token='sq_'+'a'.repeat(40),{window,calls}=setup([['starquest_ledger_device_v1:kris',token]]);await window.QuantaCloudConnection.authenticatedFetch('https://quanta-phi-ledger.marvaseater.workers.dev/v1/quants/search',{method:'POST',body:{search_id:'same-id'}});assert.equal(calls[0].opts.headers.authorization,'Bearer '+token);assert.equal(calls[0].opts.body,'{"search_id":"same-id"}')});
test('ambiguous devices and another account never silently choose a credential',async()=>{for(const entries of [[['starquest_ledger_device_v1:a','sq_'+'a'.repeat(40)],['starquest_ledger_device_v1:b','sq_'+'b'.repeat(40)]],[['starquest_session','{"username":"other"}'],['starquest_ledger_device_v1:a','sq_'+'a'.repeat(40)]]]){const {window,calls}=setup(entries);await assert.rejects(window.QuantaCloudConnection.authenticatedFetch('https://quanta-phi-ledger.marvaseater.workers.dev/v1/quants/history'),/ledger_not_connected/);assert.equal(calls.length,0)}});
test('paid-domain bridge accepts only its exact frame and origin, preserves existing data',async()=>{
 const map=new Map([['quantaPhiTokens','80']]),events=new Map(),frame={contentWindow:{postMessage(){}},remove(){this.removed=true}};
 const document={body:{appendChild(){}},createElement:()=>frame,dispatchEvent(){},addEventListener(){}};
 const window={addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k),dispatchEvent(){}};
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),key:i=>[...map.keys()][i],get length(){return map.size}};
 vm.runInNewContext(fs.readFileSync('cloud-wallet-client.js','utf8'),{window,localStorage:storage,document,location:{origin:'https://quantaphi.net',href:'https://quantaphi.net/?q=alpha'},crypto:{randomUUID:()=> 'nonce'},URL,Set,setTimeout:()=>1,clearTimeout(){},StorageEvent:function(){},CustomEvent:function(){}});
 const receive=events.get('message'),data={type:'quanta:link-response',nonce:'nonce',values:{quantaPhiTokens:'79',quantaPhiBuildHistoryV1:'[{"id":"saved"}]'}};
 receive({origin:'https://untrusted.example',source:frame.contentWindow,data});assert.equal(map.has('quantaPhiBuildHistoryV1'),false);
 receive({origin:'https://www-infinity4.github.io',source:frame.contentWindow,data});await window.QuantaCloudConnection.ready;
 assert.equal(map.get('quantaPhiTokens'),'80');assert.equal(map.get('quantaPhiBuildHistoryV1'),'[{"id":"saved"}]');assert.equal(frame.removed,true);
});

function ownershipFixture(states,session=null){
 const a='sq_'+'a'.repeat(40),b='sq_'+'b'.repeat(40),map=new Map([['starquest_ledger_device_v1:a',a],['starquest_ledger_device_v1:b',b]]),calls=[];
 if(session)map.set('starquest_session',JSON.stringify({key:session,username:session}));
 const localStorage={getItem:k=>map.get(k)??null,key:i=>[...map.keys()][i],get length(){return map.size},setItem:(k,v)=>map.set(k,v)};
 const window={};vm.runInNewContext(fs.readFileSync('cloud-wallet-client.js','utf8'),{window,localStorage,location:{origin:'https://www-infinity4.github.io'},URL,Set,AbortSignal,console,fetch:async(url,options)=>{calls.push({url,options});const state=states[options.headers.authorization];return{ok:Boolean(state),json:async()=>state?{ok:true,state}:{ok:false}}}});
 return{window,calls,a,b,map};
}
test('cloud ownership resolves exactly one valid saved account without selecting another session',async()=>{
 const f=ownershipFixture({['Bearer '+('sq_'+'b'.repeat(40))]:{username:'b'}});
 assert.equal(await f.window.QuantaCloudConnection.resolveDeviceToken(),f.b);assert.equal(f.calls.length,2);
});
test('two cloud-valid accounts remain ambiguous even when local profiles name both',async()=>{
 const f=ownershipFixture({['Bearer '+('sq_'+'a'.repeat(40))]:{username:'a'},['Bearer '+('sq_'+'b'.repeat(40))]:{username:'b'}});
 f.map.set('starquest_users',JSON.stringify({a:{key:'a'},b:{key:'b'}}));
 assert.equal(await f.window.QuantaCloudConnection.resolveDeviceToken(),'');assert.equal(f.calls.length,2);
});
test('a cloud response for a different username cannot relabel a saved credential',async()=>{
 const f=ownershipFixture({['Bearer '+('sq_'+'a'.repeat(40))]:{username:'other'}});
 assert.equal(await f.window.QuantaCloudConnection.resolveDeviceToken(),'');assert.equal(f.map.has('starquest_ledger_device_v1:other'),false);
});
test('selected account without a matching saved token never probes another account',async()=>{
 const f=ownershipFixture({},'other');assert.equal(await f.window.QuantaCloudConnection.resolveDeviceToken(),'');assert.equal(f.calls.length,0);
});
