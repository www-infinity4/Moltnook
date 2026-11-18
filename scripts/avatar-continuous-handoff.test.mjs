import test from 'node:test';
import assert from 'node:assert/strict';
import {runSignedAvatarHandoff} from './avatar-continuous-handoff.mjs';

const sha='a'.repeat(40);
function harness({grant=true,second=true,bridgeOk=true}={}){
 const calls=[];
 async function send(kind,payload){
  calls.push({kind,payload});
  if(kind==='conversation'){
   if(payload.operation==='status')return grant?{ok:true,jobId:'chatgpt_runner_12345'}:{ok:false,error:'consent_expired'};
   if(payload.operation==='assist')return {ok:true,state:'complete'};
   if(payload.operation==='result')return {ok:true,state:'complete',
    result:second||payload.turn===0?{ok:true,output:'Real signed Bubbles reply on turn '+payload.turn,receipt:{tool:'oracle.chat',status:'complete'}}:{ok:false,output:''}};
  }
  if(kind==='bridge')return bridgeOk?
   {ok:true,ticketId:'IW-TEST',repository:'www-infinity4/QuantaPhi',
    jobCount:2,orderId:'avatar-1921-session-02',sourceSha:sha,
    deduplicated:false,completed:false,execution:{status:'queued_for_runner'}}:
   {ok:false,error:'owner_bridge_order_conflict'};
  throw Error('unknown mocked boundary');
 }
 return {calls,run:()=>runSignedAvatarHandoff({runId:'12345',sourceSha:sha,send})};
}
test('actual signed assist/result for two turns precedes one durable dependent-job dispatch',async()=>{
 const h=harness();const out=await h.run();
 assert.equal(out.jobCount,2);
 assert.equal(out.completed,false);
 assert.deepEqual(h.calls.map(x=>x.kind),['conversation','conversation','conversation','conversation','conversation','bridge']);
 assert.deepEqual(h.calls.filter(x=>x.kind==='conversation').map(x=>x.payload.operation),
  ['status','assist','result','assist','result']);
 const job=h.calls.at(-1).payload;
 assert.equal(job.orderId,'avatar-1921-session-02');
 assert.equal(job.sourceSha,sha);
 assert.deepEqual(job.jobs.map(x=>x.dependencies),[[],['TASK-1']]);
 assert.deepEqual(job.conversationReceipts.map(x=>x.turn),[0,1]);
 assert.ok(job.conversationReceipts.every(x=>/^[a-f0-9]{64}$/.test(x.outputSha256)));
 assert.ok(job.conversationReceipts.every(x=>x.toolStatus==='complete'));
 assert.ok(job.conversationReceipts.every(x=>x.tool==='oracle.chat'));
 assert.equal(out.conversationTurns.length,2);
 assert.equal(out.execution.status,'queued_for_runner');
 assert.ok(!JSON.stringify(out).includes('Bearer '));
});
test('expired grant prevents any conversation turn or job creation',async()=>{
 const h=harness({grant:false});
 await assert.rejects(h.run(),/grant_unavailable/);
 assert.deepEqual(h.calls.map(x=>x.payload.operation),['status']);
});
test('failed Bubbles result cannot dispatch a job or masquerade as success',async()=>{
 const h=harness({second:false});await assert.rejects(h.run(),/conversation_unverified/);
 assert.equal(h.calls.some(x=>x.kind==='bridge'),false);
});
test('existing order conflicts are hard failures, never a second dispatch',async()=>{
 const h=harness({bridgeOk:false});await assert.rejects(h.run(),/bridge_rejected/);
 assert.equal(h.calls.filter(x=>x.kind==='bridge').length,1);
});
test('bad owner source pin or malformed signed run are rejected before calls',async()=>{
 const h=harness();
 await assert.rejects(runSignedAvatarHandoff({runId:'../',sourceSha:sha,send:async()=>{throw Error('never');}}),/invalid_handoff_scope/);
 await assert.rejects(runSignedAvatarHandoff({runId:'12345',sourceSha:'main',send:async()=>{throw Error('never');}}),/invalid_handoff_scope/);
 assert.equal(h.calls.length,0);
});

test('Bubbles tool failure is not an owner job authorization',async()=>{
 const calls=[];
 await assert.rejects(runSignedAvatarHandoff({runId:'12345',sourceSha:sha,
  send:async(kind,payload)=>{
   calls.push({kind,payload});
   if(kind==='bridge')throw Error('bridge must never be reached');
   if(payload.operation==='status')return {ok:true,jobId:'chatgpt_runner_12345'};
   if(payload.operation==='assist')return {ok:true,state:'complete'};
   return {ok:true,state:'complete',result:{ok:true,output:'Something was said',receipt:{tool:'oracle.chat',status:'failed'}}};
  }}),/conversation_unverified/);
 assert.equal(calls.some(x=>x.kind==='bridge'),false);
});
