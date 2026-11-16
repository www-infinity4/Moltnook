import test from 'node:test';
import assert from 'node:assert/strict';
import {forkApprovedTool,approvedForkTools} from './fork-approved-tool.mjs';

function makeRequest({owner='www-infinity4',existing=false,sourceParent='morluto/rea',failPost=false}={}){
 let didCreate=existing;
 const requests=[];
 const request=async(url,opts)=>{
  const path=url.replace('https://api.github.com','');
  requests.push({path,method:opts.method});
  if(path==='/user')return Response.json({login:owner});
  if(path==='/repos/www-infinity4/rea')return didCreate
   ?Response.json({full_name:'www-infinity4/rea',fork:true,parent:{full_name:sourceParent},default_branch:'main'})
   :Response.json({},{status:404});
  if(path==='/repos/morluto/rea/forks'&&opts.method==='POST'){
   if(failPost)throw Error('timeout');
   didCreate=true;
   return Response.json({},{status:202});
  }
  throw Error('Unexpected URL '+url);
 };
 return {request,requests};
}
test('REA is the only new tool approved for a source fork',()=>{
 assert.deepEqual(Object.keys(approvedForkTools),['rea']);
 assert.equal(approvedForkTools.rea.upstream,'morluto/rea');
});
test('owner may fork REA and exact parent is verified without claiming runtime',async()=>{
 const ctx=makeRequest();
 const result=await forkApprovedTool('synthetic-token',{tool:'rea',actor:'www-infinity4',request:ctx.request,pause:async()=>{}});
 assert.equal(result.verified,true);
 assert.equal(result.receipts[0].status,'fork_verified');
 assert.equal(result.receipts[0].mutationSubmitted,true);
 assert.equal(result.brainToolConnected,false);
 assert.equal(result.runtimeInstalled,false);
 assert.equal(ctx.requests.filter(x=>x.method==='POST').length,1);
});
test('existing verified fork is reused without a second POST',async()=>{
 const ctx=makeRequest({existing:true});
 const result=await forkApprovedTool('synthetic-token',{tool:'rea',actor:'www-infinity4',request:ctx.request});
 assert.equal(result.verified,true);
 assert.equal(result.receipts[0].mutationSubmitted,false);
 assert.equal(ctx.requests.filter(x=>x.method==='POST').length,0);
});
test('unauthorized caller or tool never reaches GitHub API',async()=>{
 const ctx=makeRequest();
 await assert.rejects(forkApprovedTool('synthetic-token',{tool:'rea',actor:'visitor',request:ctx.request}),/owner_actor_required/);
 await assert.rejects(forkApprovedTool('synthetic-token',{tool:'chromium',actor:'www-infinity4',request:ctx.request}),/upstream_not_approved/);
 assert.equal(ctx.requests.length,0);
});
test('GitHub token identity mismatch aborts before POST',async()=>{
 const ctx=makeRequest({owner:'someone-else'});
 await assert.rejects(forkApprovedTool('synthetic-token',{tool:'rea',actor:'www-infinity4',request:ctx.request}),/fork_owner_mismatch/);
 assert.equal(ctx.requests.filter(x=>x.method==='POST').length,0);
});
test('wrong parent refuses to declare verified',async()=>{
 const ctx=makeRequest({existing:true,sourceParent:'someone/rea'});
 const result=await forkApprovedTool('synthetic-token',{tool:'rea',actor:'www-infinity4',request:ctx.request});
 assert.equal(result.verified,false);
 assert.equal(result.receipts[0].status,'blocked');
 assert.equal(ctx.requests.filter(x=>x.method==='POST').length,0);
});
test('ambiguous timeout is not retried or reported as a successful fork',async()=>{
 const ctx=makeRequest({failPost:true});
 const result=await forkApprovedTool('synthetic-token',{tool:'rea',actor:'www-infinity4',request:ctx.request});
 assert.equal(result.verified,false);
 assert.equal(result.receipts[0].status,'unconfirmed');
 assert.equal(ctx.requests.filter(x=>x.method==='POST').length,1);
});


test('credentialed fork dispatch is restricted to checked-out main',async()=>{
 const {readFile}=await import('node:fs/promises');
 const workflow=await readFile(new URL('../../.github/workflows/bubbles-approved-tool-forks.yml',import.meta.url),'utf8');
 const guard=workflow.match(/fork-approved-source:\n\s+if: ([^\n]+)/)?.[1];
 assert.ok(guard,'fork job must have an explicit if guard');
 assert.match(guard,/github\.event_name\s*==\s*'workflow_dispatch'/);
 assert.match(guard,/github\.actor\s*==\s*'www-infinity4'/);
 assert.match(guard,/github\.ref\s*==\s*'refs\/heads\/main'/);
});
