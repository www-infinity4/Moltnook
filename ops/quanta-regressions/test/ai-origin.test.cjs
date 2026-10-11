const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
// HTTP routing is independent of the Cloudflare-only private RPC entrypoint.
const source=fs.readFileSync('workers/infinity-rogers/worker.js','utf8');
const rpcExport='export { BrainModels } from "./brain-models.js";';
assert.equal(source.split(rpcExport).length,2);
const worker=import('data:text/javascript;base64,'+Buffer.from(source.replace(rpcExport,'')).toString('base64'));
test('QuantaPhi org and existing origins can reach the AI service',async()=>{
 const app=(await worker).default;
 for(const origin of ['https://quantaphi.org','https://www.quantaphi.org','https://quantaphi.net','https://www-infinity4.github.io']){
  const response=await app.fetch(new Request('https://gateway.test/v1/chat',{method:'OPTIONS',headers:{Origin:origin}}),{});
  assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
 }
 const denied=await app.fetch(new Request('https://gateway.test/v1/chat',{method:'OPTIONS',headers:{Origin:'https://unrelated.example'}}),{});
 assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
});
test('org POST reaches the configured model with its existing bindings',async()=>{
 const app=(await worker).default;
 const env={AI:{run:async()=>({response:'Verified overview'})},METER_DB:{prepare:()=>({bind(){return this},first:async()=>null,run:async()=>({success:true})})}};
 const response=await app.fetch(new Request('https://gateway.test/v1/chat',{method:'POST',headers:{Origin:'https://quantaphi.org','Content-Type':'application/json'},body:JSON.stringify({input:'Connectivity test',context:{requireCloudflare:true}})}),env);
 assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://quantaphi.org');assert.equal((await response.json()).output_text,'Verified overview');
});
