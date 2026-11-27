import test from 'node:test';
import './brain-origin.test.mjs';
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
test('configured owner host receives credential and operations without redirects or Cloudflare fallback',async()=>withActionsIdentity(async()=>{
 const before=process.env.BRAIN_RUNNER_ORIGIN;
 process.env.BRAIN_RUNNER_ORIGIN='https://owner-brain.example.org';
 const requests=[];
 const request=async(url,options)=>{
  const address=String(url);requests.push({address,options});
  if(address.startsWith('https://identity.test/'))return Response.json({value:'test-oidc'});
  assert.ok(address.startsWith('https://owner-brain.example.org/runner/'));
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,'Bearer test-oidc');
  return Response.json({ok:true,status:'connected'});
 };
 try{
  await connectExistingCredential({token:'test-existing-owner-key',request});
  await runnerCall('claim',{},request);
  assert.deepEqual(requests.filter(x=>!x.address.startsWith('https://identity.test/')).map(x=>x.address),[
   'https://owner-brain.example.org/runner/github-credential','https://owner-brain.example.org/runner/claim'
  ]);
  let posts=0;
  await assert.rejects(runnerCall('claim',{},async(url,options)=>{
   if(String(url).startsWith('https://identity.test/'))return Response.json({value:'test-oidc'});
   posts++;assert.equal(options.redirect,'error');throw TypeError('redirect rejected');
  }),/redirect rejected/);
  assert.equal(posts,1,'an uncertain claim must never switch to a second authority');
 }finally{
  if(before===undefined)delete process.env.BRAIN_RUNNER_ORIGIN;else process.env.BRAIN_RUNNER_ORIGIN=before;
 }
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

test('Brain HTTP 429 is explicit without repeating credential POST',async()=>withActionsIdentity(async()=>{
 let calls=0;
 await assert.rejects(connectExistingCredential({token:'fixture-key',request:async()=>++calls===1?Response.json({value:'fixture-oidc'}):new Response('error code: 1027',{status:429})}),{message:'brain_runner_rate_limited_http_429'});
 assert.equal(calls,2);
}));
test('Brain HTML errors preserve status without exposing response body',async()=>withActionsIdentity(async()=>{
 let calls=0;
 await assert.rejects(runnerCall('quant-audit',{},async()=>++calls===1?Response.json({value:'fixture-oidc'}):new Response('<!DOCTYPE html>private-body',{status:503})),{message:'brain_runner_invalid_json_http_503'});
 assert.equal(calls,2);
}));
test('OIDC HTML success fails closed before Brain POST',async()=>withActionsIdentity(async()=>{
 let calls=0;
 await assert.rejects(connectExistingCredential({token:'fixture-key',request:async()=>{calls++;return new Response('<!DOCTYPE html>private-body',{status:200});}}),{message:'github_runner_identity_invalid_json_http_200'});
 assert.equal(calls,1);
}));

test('credential bridge rejects non-boolean success flag',async()=>withActionsIdentity(async()=>{
 let calls=0;
 await assert.rejects(connectExistingCredential({token:'fixture',request:async()=>++calls===1?Response.json({value:'oidc'}):Response.json({ok:'false',status:'connected'})}),{message:'github_credential_bridge_failed'});
 assert.equal(calls,2);
}));
test('Brain operation rejects non-boolean success flag',async()=>withActionsIdentity(async()=>{
 let calls=0;
 await assert.rejects(runnerCall('quant-audit',{},async()=>++calls===1?Response.json({value:'oidc'}):Response.json({ok:'false'})),{message:'brain_runner_call_failed'});
 assert.equal(calls,2);
}));
