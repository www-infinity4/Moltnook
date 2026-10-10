import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyAdapters} from './adapter-verification.mjs';
test('live health and schema success cannot become execution success',async()=>{
 const fetcher=async url=>new Response(JSON.stringify(url.includes('catalog')?{version:4,sectors:[{id:1,name:'Energy'}]}:url.includes('wallet/state')?{balances:{STAR:1}}:url.includes('api.github')?{full_name:'www-infinity4/Moltnook'}:{ok:true,service:'quantaphi-site'}));
 const r=await verifyAdapters({fetcher,walletToken:'private-wallet',githubToken:'private-github'});
 assert.equal(r.adapters.catalog.status,'verified_read');assert.equal(r.adapters.wallet.status,'verified_read');
 for(const k of ['deployment','images','forks'])assert.equal(r.adapters[k].executionVerified,false);
 assert.ok(!JSON.stringify(r).includes('private-'));
});
test('failed auth, absent credentials and malformed catalog stay unverified',async()=>{
 const r=await verifyAdapters({fetcher:async()=>new Response('{}')});assert.equal(r.adapters.wallet.status,'credential_missing');assert.equal(r.adapters.catalog.status,'invalid_response');
 const denied=await verifyAdapters({walletToken:'secret',fetcher:async()=>new Response('{}',{status:401})});assert.equal(denied.adapters.wallet.status,'failed');
});
