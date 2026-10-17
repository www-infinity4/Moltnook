import test from 'node:test';
import assert from 'node:assert/strict';
import {connectExistingCredential,fetchRunnerOidcIdentity,runnerCall} from './credential-bridge.mjs';

async function withActionsIdentity(fn){
 const url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
 const token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 process.env.ACTIONS_ID_TOKEN_REQUEST_URL='https://identity.test/token';
 process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN='test-actions-runtime-token';
 try{return await fn();}
 finally{
  if(url===undefined)delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  else process.env.ACTIONS_ID_TOKEN_REQUEST_URL=url;
  if(token===undefined)delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  else process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN=token;
 }
}
test('bridge uses existing Actions identity and sends the key only to the authenticated Brain endpoint',async()=>withActionsIdentity(async()=>{
 const calls=[],token='test-existing-key';
 const result=await connectExistingCredential({token,request:async(url,options)=>{
  calls.push({url:String(url),options});
  return calls.length===1?Response.json({value:'test-oidc'}):
   Response.json({ok:true,status:'connected',login:'www-infinity4',source:'Moltnook Actions GHP'});
 }});
 assert.equal(result.status,'connected');
 assert.equal(calls.length,2);
 assert.equal(new URL(calls[0].url).searchParams.get('audience'),'infinity-brain-writer');
 assert.equal(calls[1].url,'https://infinity-brain-clock.marvaseater.workers.dev/runner/github-credential');
 assert.equal(calls[1].options.headers.Authorization,'Bearer test-oidc');
 assert.equal(JSON.parse(calls[1].options.body).token,token);
 assert.ok(!JSON.stringify(result).includes(token));
}));
test('transient 15-second OIDC timeout retries and connects without any extra Brain writes',async()=>withActionsIdentity(async()=>{
 let attempts=0,posts=0;const delays=[];
 const result=await connectExistingCredential({token:'test-owner-key',wait:async ms=>{delays.push(ms);},
  request:async(url)=>{
   if(String(url).startsWith('https://identity.test/')){
    attempts++;
    if(attempts<=2){const e=Error('The operation was aborted due to timeout');e.name='TimeoutError';throw e;}
    return Response.json({value:'verified-oidc'});
   }
   posts++;
   return Response.json({ok:true,status:'connected',login:'www-infinity4'});
  }
 });
 assert.equal(result.status,'connected');
 assert.equal(attempts,3);
 assert.equal(posts,1);
 assert.deepEqual(delays,[500,1000]);
}));
test('credential bridge fails closed on HTTP 401 or 403 without retry or Brain POST',async()=>withActionsIdentity(async()=>{
 for(const status of [401,403]){
  let count=0;
  await assert.rejects(
   connectExistingCredential({token:'test-owner-key',wait:async()=>assert.fail('must not retry denial'),
    request:async()=>{count++;return Response.json({error:'denied'},{status});}}),
   new RegExp('github_runner_identity_http_'+status)
  );
  assert.equal(count,1);
 }
}));
test('transient OIDC requests stop at three attempts and do not send credential',async()=>withActionsIdentity(async()=>{
 let attempts=0;
 await assert.rejects(
  connectExistingCredential({token:'test-owner-key',wait:async()=>{},
   request:async(url)=>{
    assert.ok(String(url).startsWith('https://identity.test/'));
    attempts++;
    return Response.json({message:'unavailable'},{status:503});
   }}),
  /github_runner_identity_transient_exhausted/
 );
 assert.equal(attempts,3);
}));
test('missing Actions identity environment or missing existing secret cannot bypass auth',async()=>withActionsIdentity(async()=>{
 assert.deepEqual(await connectExistingCredential({token:'',request:async()=>assert.fail('no requests expected')}),
  {ok:false,error:'existing_GHP_secret_missing'});
 const old=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 try{
  await assert.rejects(fetchRunnerOidcIdentity({request:async()=>assert.fail('no requests expected')}),/github_runner_identity_environment_missing/);
 }finally{process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN=old;}
}));
test('regular authenticated Brain operations share bounded OIDC retry, without replaying Brain POST',async()=>withActionsIdentity(async()=>{
 let identity=0,brain=0;
 const response=await runnerCall('quant-audit',{},async(url)=>{
  if(String(url).startsWith('https://identity.test/')){
   identity++;
   return Response.json({value:'oidc'});
  }
  brain++;
  return Response.json({ok:true,status:'verified'});
 });
 assert.equal(response.status,'verified');
 assert.equal(identity,1);
 assert.equal(brain,1);
}));
