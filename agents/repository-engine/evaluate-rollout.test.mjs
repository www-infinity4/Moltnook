import {test} from 'node:test';import assert from 'node:assert/strict';import {evaluateRollout} from './evaluate-rollout.mjs';
const stable='11111111-1111-1111-1111-111111111111',candidate='22222222-2222-2222-2222-222222222222';
const evidence={workerName:'quantaphi-site',candidate:{fixture:false,commitSha:'new',versionId:candidate},stable:{commitSha:'old',versionId:stable},checks:{sourceMatched:true,browserPassed:true,purpleApproved:true},samples:20,errors:0,weight:0,migrationsReversible:true,expectedDeploymentId:'before'};
test('API mutation and readback apply progressive weight and rollback to stable',async()=>{
 for(const errors of [0,1]){let live={id:'before',versions:[{version_id:stable,percentage:100}]},writes=0;
 const fetcher=async(_url,request)=>{if(request.method==='POST'){writes++;live={id:'after',versions:JSON.parse(request.body).versions}}return Response.json({success:true,result:request.method==='GET'?{deployments:[live]}:live});};
 const r=await evaluateRollout({evidence:{...evidence,errors},token:'private',context:{productionAccess:true},fetcher});assert.equal(r.executed,true);assert.equal(r.readbackVerified,true);assert.equal(writes,1);assert.equal(r.action,errors?'rollback':'promote');assert.ok(!JSON.stringify(r).includes('private'));}
});
test('missing credentials and stale deployment never mutate traffic',async()=>{
 assert.equal((await evaluateRollout({evidence,context:{productionAccess:true}})).executed,false);
 let writes=0;await assert.rejects(evaluateRollout({evidence,token:'private',context:{productionAccess:true},fetcher:async(_u,r)=>{if(r.method==='POST')writes++;return Response.json({success:true,result:{deployments:[{id:'changed'}]}})}}),/changed/);assert.equal(writes,0);
});
