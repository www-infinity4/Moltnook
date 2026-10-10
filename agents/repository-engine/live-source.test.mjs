import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeLiveSource} from './live-source.mjs';
test('live source requires exact bytes and never claims feature acceptance',async()=>{
 const args={repository:'www-infinity4/QuantaPhi',commitSha:'a'.repeat(40),patched:{'app.js':'new source','workers/secret.js':'hidden','index.html':'rewritten'}};
 const good=await observeLiveSource({...args,fetcher:async()=>new Response('new source')});
 assert.equal(good.status,'published_source_matches');assert.equal(good.featureAcceptance,false);assert.equal(good.files.length,1);
 const stale=await observeLiveSource({...args,fetcher:async()=>new Response('old source')});assert.equal(stale.status,'published_source_mismatch');
 const blocked=await observeLiveSource({...args,fetcher:async()=>{throw Error('redirect rejected')}});assert.equal(blocked.files[0].matched,false);
});
test('unknown repositories and traversal never make network requests',async()=>{
 const fetcher=async()=>{throw Error('must not fetch')};
 assert.equal((await observeLiveSource({repository:'other/repo',patched:{'app.js':'x'},fetcher})).status,'unsupported_route');
 assert.equal((await observeLiveSource({repository:'www-infinity4/QuantaPhi',patched:{'../app.js':'x'},fetcher})).status,'no_exact_public_assets');
});
