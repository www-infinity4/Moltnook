import test from 'node:test';
import assert from 'node:assert/strict';
import {selectLatestFailures,buildReceipt,planTicketChanges,runWatch} from './workflow-watch.mjs';
const mk=(id,path,branch,conclusion,created_at='2026-11-20T04:00:00Z')=>({
  id,path,head_branch:branch,status:'completed',conclusion,created_at,
  head_sha:String(id).padStart(40,'a'),
  html_url:'https://github.com/www-infinity4/Moltnook/actions/runs/'+id
});
const NOW=Date.parse('2026-11-20T04:05:00Z');
test('newer success supersedes earlier failures for same workflow and branch',()=>{
 const runs=[
  mk(4,'.github/workflows/a.yml','main','success','2026-11-20T04:03:00Z'),
  mk(3,'.github/workflows/a.yml','main','failure','2026-11-20T04:02:00Z'),
  mk(2,'.github/workflows/a.yml','feature','failure','2026-11-20T04:01:00Z')
 ];
 assert.deepEqual(selectLatestFailures('Moltnook',runs,{now:NOW}).map(x=>x.run_id),[2]);
});
test('pending run supersedes prior failure; watcher does not watch itself',()=>{
 const pending={...mk(8,'.github/workflows/a.yml','main','failure','2026-11-20T04:04:00Z'),status:'in_progress',conclusion:null};
 const old=mk(7,'.github/workflows/a.yml','main','failure');
 const self=mk(6,'.github/workflows/robot-brain-auto-tickets.yml','main','failure');
 assert.deepEqual(selectLatestFailures('Moltnook',[pending,old,self],{now:NOW}),[]);
});
test('old, malformed or untrusted run URLs are excluded',()=>{
 const old=mk(1,'.github/workflows/a.yml','main','failure','2026-11-18T04:00:00Z');
 const bad={...mk(5,'.github/workflows/a.yml','feature','failure'),html_url:'https://evil.example/x'};
 assert.deepEqual(selectLatestFailures('Moltnook',[bad,old],{now:NOW}),[]);
});
test('receipt pins SHA and run URL but never claims repair or merge',()=>{
 const f=selectLatestFailures('Moltnook',[mk(11,'.github/workflows/b.yml','main','failure')],{now:NOW})[0];
 const receipt=buildReceipt(f);
 assert.match(receipt,/Not repaired/);
 assert.match(receipt,/signed owner/);
 assert.match(receipt,/actions\/runs\/11/);
 assert.doesNotMatch(receipt,/auto-merged/);
});
test('one existing repair issue gets new evidence once; no duplicate ticket',()=>{
 const f=selectLatestFailures('Moltnook',[mk(11,'.github/workflows/b.yml','main','failure')],{now:NOW})[0];
 const issue={number:33,title:'[Agent Job] Moltnook · failed-workflow',body:'Prior tracked failure'};
 const changes=planTicketChanges([f],[issue]);
 assert.equal(changes.length,1);
 assert.equal(changes[0].kind,'update');
 assert.equal(changes[0].number,33);
 assert.deepEqual(planTicketChanges([f],[{...issue,body:changes[0].body}]),[]);
});
test('two failed workflows in same repo share a single bounded ticket',()=>{
 const a=selectLatestFailures('Moltnook',[
  mk(11,'.github/workflows/b.yml','main','failure'),
  mk(12,'.github/workflows/c.yml','feature','failure')
 ],{now:NOW});
 const plan=planTicketChanges(a,[]);
 assert.equal(plan.length,1);
 assert.equal(plan[0].kind,'create');
 assert.match(plan[0].body,/actions\/runs\/11/);
 assert.match(plan[0].body,/actions\/runs\/12/);
});
test('missing credential fails closed without reading or writing GitHub',async()=>{
 const result=await runWatch({token:'',now:NOW,api:async()=>{throw Error('should not call')}});
 assert.equal(result.state,'blocked_missing_owner_credential');
 assert.deepEqual(result.ticket_changes,[]);
});
test('passing workflow inventory never creates tickets',async()=>{
 const calls=[];
 const result=await runWatch({token:'fixture',now:NOW,api:async(_token,route)=>{
   calls.push(route);
   return {workflow_runs:[]};
 }});
 assert.equal(result.state,'no_failures');
 assert.equal(result.ticket_changes.length,0);
 assert.equal(calls.length,4);
});
