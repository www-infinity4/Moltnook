import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
test('sandbox image fixture is explicit and rejects wallet and credential use',async()=>{
 const env={ENVIRONMENT:'sandbox'},call=(path,options)=>worker.fetch(new Request('https://fixture.invalid'+path,options),env);
 const response=await call('/v1/image',{method:'POST',body:JSON.stringify({prompt:'robot',mode:'Image',reference_mode:'text-only'})});const r=await response.json();assert.equal(r.fixture,true);assert.equal(r.realGeneration,false);assert.equal(r.productionAccess,false);
 assert.equal((await call('/v1/image',{method:'POST',body:'{}'})).status,422);
 assert.equal((await call('/v1/wallet/state')).status,403);
 assert.equal((await call('/v1/image',{method:'POST',headers:{authorization:'Bearer private'},body:'{}'})).status,400);
});
