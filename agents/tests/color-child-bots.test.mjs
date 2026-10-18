import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnColorChild,selectChildRoles,inspectChild,parentReport,responsibilitiesFor,reasonColorChild} from '../color-child-bots.mjs';
const roster=['green','blue','yellow','pink','black','purple','orange','red'].map(color=>({id:({green:'greenbeans',blue:'blueberry',yellow:'naked-gold-digger',pink:'pink-panther',black:'black-seal',purple:'purple-pearl',orange:'orange-peel',red:'red-macro-reader'})[color],name:color+' desk',color}));
const job={id:'MN-002',repo:'Moltnook',sourceUrl:'https://github.com/www-infinity4/Moltnook/blob/main/agents/jobs.json'};
const parent=()=>({id:'specialist-mn-002',jobId:job.id,color:'green',depth:1,permissions:['read public repository','write Moltnook evidence'],tools:['github-public-read','moltnook-evidence-write']});
const params=(agents,roleId='pink-panther',parentId=parent().id)=>({agents,roster,parentId,job,roleId,task:'Inspect test evidence',completion:'Record CI result and source link',now:'2026-10-13T20:00:00Z'});
test('parent selects specialists of complementary colors',()=>{
 const ids=selectChildRoles(parent(),roster);assert.deepEqual(ids,['naked-gold-digger','pink-panther','black-seal']);
 assert.match(responsibilitiesFor('black')[0],/Seal/);
});
test('spawn is idempotent, parent-linked and grants no stronger tools',()=>{
 const agents=[parent()];const first=spawnColorChild(params(agents));const second=spawnColorChild(params(agents));
 assert.equal(first.created,true);assert.equal(second.created,false);assert.equal(agents.length,2);
 assert.equal(first.agent.parentId,parent().id);assert.equal(first.agent.depth,2);
 assert.deepEqual(first.agent.tools,['github-public-read','moltnook-evidence-write']);
 assert.equal(first.agent.receipt,null);assert.equal(first.agent.status,'delegated');
});
test('every color child may spawn a bounded grandchild and inherit reduced permissions',()=>{
 const agents=[parent()];const first=spawnColorChild(params(agents)).agent;
 const nested=spawnColorChild({...params(agents,'purple-pearl',first.id),task:'Explain CI state'}).agent;
 assert.equal(nested.depth,3);assert.equal(nested.parentId,first.id);
 assert.throws(()=>spawnColorChild({...params(agents,'greenbeans',nested.id),task:'Attempt fourth depth'}),/depth/);
});
test('rejects cross-job delegation, fourth sibling and global registry expansion',()=>{
 const agents=[parent()];
 assert.throws(()=>spawnColorChild({...params(agents),job:{...job,id:'FOREIGN'}}),/job scope/);
 for(const roleId of ['pink-panther','naked-gold-digger','blueberry'])spawnColorChild(params(agents,roleId));
 assert.throws(()=>spawnColorChild(params(agents,'black-seal')),/limit/);
 const full=[parent()];assert.throws(()=>spawnColorChild({...params(full),limits:{maxDepth:3,maxChildrenPerParent:3,maxAgents:1}}),/full/);
});
test('records real read-only evidence only and correctly reports blockers',()=>{
 const agents=[parent()];const child=spawnColorChild(params(agents)).agent;
 const head={url:'https://github.com/www-infinity4/Moltnook/commit/a',sha:'a'.repeat(40)};
 const ci={status:'failure',url:'https://github.com/www-infinity4/Moltnook/actions/runs/1'};
 const checked=inspectChild({child,job,head,mission:{title:'Moltnook'},checks:[{path:'README.md',found:true}],ci,now:'2026-10-13T20:10:00Z'});
 assert.equal(checked.status,'needs_work');assert.equal(checked.receipt.codeWritten,false);
 assert.equal(checked.receipt.deployed,false);assert.equal(checked.receipt.walletChanged,false);
 agents[1]=checked;
 assert.deepEqual(parentReport(agents,parent().id).childIds,[child.id]);
});
test('no fabricated release success for black seal',()=>{
 const agents=[parent()], child=spawnColorChild(params(agents,'black-seal')).agent;
 const inspected=inspectChild({child,job,head:{sha:'a'.repeat(40),url:job.sourceUrl},mission:{title:'ok'},checks:[],ci:{status:'success'},now:'2026-10-13T20:20:00Z'});
 assert.equal(inspected.status,'needs_work');assert.match(inspected.receipt.result,/NOT verified/);
});


test('every delegated role has a GPT core contract but no invented inference receipt',()=>{
 const agents=[parent()];
 const child=spawnColorChild(params(agents,'pink-panther')).agent;
 assert.equal(child.modelCore.model,'@cf/openai/gpt-oss-120b');
 assert.equal(child.modelCore.status,'model_available_not_invoked');
 assert.equal(child.modelReceipt,undefined);
 assert.ok(child.execution.includes('evidence-only'));
 const green=spawnColorChild({...params(agents,'greenbeans'),parentId:parent().id}).agent;
 assert.deepEqual(green.modelCore.layers,['green','yellow','blue','pink','red','white']);
 assert.deepEqual(responsibilitiesFor('white')[0],'Guard truthfulness, owner boundaries and source-versus-deploy claims');
});
test('registered child uses a real lease-bound GPT inference without gaining source or wallet privileges',async()=>{
 const agents=[parent()];
 const child=spawnColorChild(params(agents,'naked-gold-digger')).agent;
 const before=[...child.permissions],beforeTools=[...child.tools];
 let called=0;
 const result=await reasonColorChild({agents,childId:child.id,
  evidence:{sourceSha:'a'.repeat(40)},invoke:async(step,payload)=>{
   assert.equal(step,'color-think');assert.equal(payload.color,'yellow');
   called++;
   return {ok:true,status:'model_inference_completed',model:'@cf/openai/gpt-oss-120b',
    color:'yellow',layers:['yellow'],toolRequestsAreNotExecution:true,authorizedOperationsPerformed:false,
    finding:'Research source found',nextAction:'Check dated source',blockers:[],toolRequests:['data-extraction']};
  }});
 assert.equal(called,1);assert.equal(result.modelCore.status,'model_inference_completed');
 assert.equal(result.modelReceipt.walletChanged,false);assert.equal(result.modelReceipt.sourceCommitted,false);
 assert.deepEqual(result.permissions,before);assert.deepEqual(result.tools,beforeTools);
 assert.equal(agents.find(a=>a.id===child.id).modelReceipt.status,'model_inference_completed');
});
