import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {normalizeIteration, eventId} from './worker.mjs';

const base = () => ({
  repository:'www-infinity4/Moltnook', quantId:'quant:scan-001', jobId:'job:oracle-8',
  iterationId:'scan-1', filePath:'agents/repository-engine/context-windows.mjs',
  commitSha:'a'.repeat(40), fullFileSha256:'b'.repeat(64), snippetSha256:'c'.repeat(64),
  stage:'BLUE', outcome:'observed', assessment:'code_inspection', ruleId:'oracle.source-window',
  agentId:'pink-panther', lineStart:12, lineEnd:26, observedAt:Date.now(),
  websiteScope:'quantaphi.org', systemCreditValue:1
});
const req = (data, bearer = 's'.repeat(32)) => new Request('https://example.com/v1/iterations', {
  method:'POST', headers:{authorization:'Bearer '+bearer, 'content-type':'application/json'},
  body:JSON.stringify(data)
});

test('input contracts pin commit, 15 lines, event identities and never accept source payload', async () => {
  const sample = base();
  assert.equal(normalizeIteration(sample).lineEnd, 26);
  assert.throws(() => normalizeIteration({...sample,lineEnd:27}), /invalid_15_line_window/);
  assert.throws(() => normalizeIteration({...sample,filePath:'../../.env'}), /unsafe_file_path|invalid_file_path/);
  assert.throws(() => normalizeIteration({...sample,repository:'another-owner/Moltnook'}), /invalid_repository/);
  assert.throws(() => normalizeIteration({...sample,stage:'COMPLETE'}), /invalid_assessment_state/);
  assert.throws(() => normalizeIteration({...sample,systemCreditValue:1000000}), /invalid_telemetry_weight/);
  const n = normalizeIteration(sample), id = await eventId(n);
  assert.equal(id.length, 64);
  assert.equal(id, await eventId(normalizeIteration({...sample,observedAt:sample.observedAt+1000})));
  assert.notEqual(id, await eventId(normalizeIteration({...sample,iterationId:'scan-2'})));
  assert.equal(JSON.stringify(n).includes('rawCode'),false);
});

test('authenticated batch gets queue receipt only, not a wallet payout', async () => {
  const published = [];
  const env = {
    BOT_INGEST_TOKEN:'s'.repeat(32),
    BOT_EVENTS_QUEUE:{sendBatch:async messages => {published.push(...messages);}},
    INGEST_RATE_LIMITER:{limit:async () => ({success:true})}
  };
  assert.equal((await worker.fetch(req([base()],'bad-token'),env)).status,401);
  const response = await worker.fetch(req([base()]), env);
  assert.equal(response.status,202);
  const body = await response.json();
  assert.deepEqual({queued:body.queued,persisted:body.persisted,payoutIssued:body.payoutIssued},{queued:true,persisted:false,payoutIssued:false});
  assert.equal(published.length,1);
  assert.equal(published[0].body.id.length,64);
  assert.equal(published[0].body.rawCode,undefined);
  env.INGEST_RATE_LIMITER.limit = async () => ({success:false});
  assert.equal((await worker.fetch(req([base()]),env)).status,429);
});

test('consumer acknowledges only D1 persisted events; failures retry rather than silently drop', async () => {
  const record = normalizeIteration(base());
  record.id = await eventId(record);
  let ackCount=0, retryCount=0, commits=0;
  const msg={body:record,ack(){ackCount++},retry(){retryCount++}};
  const okDB = {
    prepare(sql){ return {bind(...args){ return {
      async all(){return {results:[]}},
      async first(){return null},
      sql, args
    }; }}; },
    async batch(statements){commits++;assert.match(statements[0].sql,/ON CONFLICT\(transition_id\) DO NOTHING/);return [{success:true,meta:{changes:1}}];}
  };
  await worker.queue({messages:[msg]}, {BOT_TRANSITIONS_DB:okDB});
  assert.equal(commits,1);
  assert.equal(ackCount,1);
  assert.equal(retryCount,0);
  const failed={...okDB,async batch(){throw Error('D1 temporarily unavailable')}};
  await worker.queue({messages:[msg]}, {BOT_TRANSITIONS_DB:failed});
  assert.equal(ackCount,1);
  assert.equal(retryCount,1);
  await worker.queue({messages:[msg]}, {});
  assert.equal(retryCount,2);
});

test('D1 duplicate ID may acknowledge after readback; an unpersisted capped event retries', async () => {
  const record=normalizeIteration(base());record.id=await eventId(record);
  let ack=0,retry=0, existing=[];
  const msg={body:record,ack(){ack++},retry(){retry++}};
  const env={BOT_TRANSITIONS_DB:{
    prepare(){return{bind(){return{async all(){return{results:existing}}}}}},
    async batch(){return[{success:true,meta:{changes:0}}]}
  }};
  await worker.queue({messages:[msg]},env);
  assert.equal(retry,1);
  existing=[{transition_id:record.id}];
  await worker.queue({messages:[msg]},env);
  assert.equal(ack,1);
});
