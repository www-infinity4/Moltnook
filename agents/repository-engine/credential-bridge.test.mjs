import test from 'node:test';
import assert from 'node:assert/strict';
import {connectExistingCredential} from './credential-bridge.mjs';
test('bridge uses existing Actions identity and sends the key only to the authenticated Brain endpoint',async()=>{
 const previous=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
 process.env.ACTIONS_ID_TOKEN_REQUEST_URL='https://identity.test/token';
 const calls=[],token='test-existing-key';
 try{
  const result=await connectExistingCredential({token,request:async(url,options)=>{calls.push({url:String(url),options});return calls.length===1?Response.json({value:'test-oidc'}):Response.json({ok:true,status:'connected',login:'www-infinity4',source:'Moltnook Actions GHP'});}});
  assert.equal(result.status,'connected');assert.equal(calls.length,2);
  assert.equal(new URL(calls[0].url).searchParams.get('audience'),'infinity-brain-writer');
  assert.equal(calls[1].url,'https://infinity-brain-clock.marvaseater.workers.dev/runner/github-credential');
  assert.equal(calls[1].options.headers.Authorization,'Bearer test-oidc');
  assert.equal(JSON.parse(calls[1].options.body).token,token);
  assert.ok(!JSON.stringify(result).includes(token));
 }finally{if(previous===undefined)delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;else process.env.ACTIONS_ID_TOKEN_REQUEST_URL=previous;}
});
