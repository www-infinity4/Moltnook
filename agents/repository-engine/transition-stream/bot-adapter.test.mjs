import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionEvents,submitInspectionEvents} from './bot-adapter.mjs';
import {sha256} from '../context-windows.mjs';

test('bot adapter turns source windows into <=15-line pinned events and never uploads source', () => {
  const raw='const book = "secret illustration";\n'.repeat(6000)+'function repairRegex() { return /abc/i; }\n';
  const {events,metadata}=inspectionEvents({
    original:{'src/code.js':raw}, task:'repairRegex',
    repository:'www-infinity4/Moltnook',commitSha:'a'.repeat(40),
    jobId:'job:123',quantId:'quant:1'
  });
  assert.ok(events.length>0);
  assert.equal(metadata.sourceHashes['src/code.js'],sha256(raw));
  for(const event of events) {
    assert.ok(event.lineEnd-event.lineStart<15);
    assert.equal(event.fullFileSha256,sha256(raw));
    assert.equal(event.systemCreditValue,1);
    assert.equal(Object.hasOwn(event,'rawCode'),false);
    assert.equal(Object.hasOwn(event,'snippet'),false);
  }
  const repeat=inspectionEvents({original:{'src/code.js':raw},task:'repairRegex',
    repository:'www-infinity4/Moltnook',commitSha:'a'.repeat(40),jobId:'job:123',quantId:'quant:1'});
  assert.deepEqual(events.map(x=>x.iterationId),repeat.events.map(x=>x.iterationId));
});

test('plugin reports queued only and refuses to claim D1 persistence or mint', async () => {
  const events=[{a:1}], requests=[];
  const receipt=await submitInspectionEvents(events,{url:'https://example.com',
    bearerToken:'x'.repeat(32),fetchImpl:async (url,options)=>{
      requests.push({url,options});
      return {status:202,async json(){return{queued:true,count:1,persisted:false}}};
    }});
  assert.deepEqual(receipt,{queued:1,persisted:false,payoutIssued:false});
  assert.equal(requests[0].url,'https://example.com/v1/iterations');
  await assert.rejects(()=>submitInspectionEvents(events,{url:'http://example.com',
    bearerToken:'x'.repeat(32)}),/not_configured/);
});
