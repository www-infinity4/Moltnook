import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCandidate,TARGETS,runAutoPromotion,discoverOpenPullRequests} from './auto-promote-reviewed.mjs';
const sha='a'.repeat(40);
function candidate(){
 return {state:'open',draft:false,mergeable:true,mergeable_state:'clean',
  title:'Robot review: TASK-1',user:{login:'www-infinity4'},
  base:{ref:'main',repo:{name:'QuantaPhi',full_name:'www-infinity4/QuantaPhi'}},
  head:{ref:'robot/TASK-1/388200123',sha,repo:{full_name:'www-infinity4/QuantaPhi'}},
  body:'Staged source commit: '+sha+'\nindependent Pink review\nGPT Purple arbitration'
 };
}
const files=[{status:'modified',filename:'phone/phone.js'}];
const checks=[{status:'completed',conclusion:'success'}];
test('only pinned owner-created bot changes with completed target checks qualify',()=>{
 assert.equal(reviewCandidate(candidate(),files,checks,[]).ready,true);
 const tampered=candidate();tampered.head.sha='b'.repeat(40);
 assert.equal(reviewCandidate(tampered,files,checks,[]).ready,false);
 assert.equal(reviewCandidate({...candidate(),user:{login:'stranger'}},files,checks,[]).ready,false);
 assert.equal(reviewCandidate(candidate(),[{status:'modified',filename:'.github/workflows/build.yml'}],checks,[]).ready,true);
 assert.equal(reviewCandidate(candidate(),[{status:'added',filename:'workers/infinity-brain-clock/worker.js'}],checks,[]).ready,true);
 assert.equal(reviewCandidate(candidate(),files,[{status:'in_progress',conclusion:null}],[]).ready,false);
 assert.equal(reviewCandidate(candidate(),files,[],[]).ready,false);
 assert.equal(reviewCandidate(candidate(),files,checks,[{state:'pending'}]).ready,false);
 assert.equal(reviewCandidate({...candidate(),mergeable_state:'behind'},files,checks,[]).ready,false);
 assert.equal(reviewCandidate({...candidate(),base:{ref:'main',repo:{name:'Other',full_name:'other/Other'}}},files,checks,[]).ready,false);
});
test('no token means zero merges and no simulated result',async()=>{
 const report=await runAutoPromotion({token:''});
 assert.equal(report.mode,'blocked_missing_writer_credential');
 assert.equal(report.merged.length,0);
 assert.ok(TARGETS.includes('QuantaPhi'));
});
test('owner-wide code authorization includes additional repositories, workflows and backend source',()=>{
 const pr=candidate();pr.base.repo={name:'WidgetPhi',full_name:'www-infinity4/WidgetPhi'};pr.head.repo.full_name=pr.base.repo.full_name;
 assert.equal(reviewCandidate(pr,[{status:'added',filename:'workers/service/worker.js'}],checks,[]).ready,true);
 assert.equal(reviewCandidate(pr,[{status:'modified',filename:'.github/workflows/check.yml'}],checks,[]).ready,true);
 assert.equal(reviewCandidate(pr,[{status:'added',filename:'.env.local'}],checks,[]).ready,false);
 assert.equal(reviewCandidate(pr,files,[...checks,{status:'completed',conclusion:'skipped'}],[]).ready,true);
});

test('owner explicitly reviews card registry and host changes even after target CI passes',()=>{
 for(const filename of ['bubbles-card-catalog.mjs','bubbles-card-host.html','bubbles-card-host.mjs','bubbles-card-workspace.mjs','bubbles-card-surface.mjs']){
  const verdict=reviewCandidate(candidate(),[{status:'modified',filename}],checks,[]);
  assert.equal(verdict.ready,false,filename);
  assert.equal(verdict.reason,'owner_card_approval_required',filename);
 }
 assert.equal(reviewCandidate(candidate(),[{status:'modified',filename:'phone/phone.js'}],checks,[]).ready,true);
 const other=candidate();
 other.base.repo={name:'WidgetPhi',full_name:'www-infinity4/WidgetPhi'};
 other.head.repo={full_name:'www-infinity4/WidgetPhi'};
 assert.equal(reviewCandidate(other,[{status:'added',filename:'bubbles-card-catalog.mjs'}],checks,[]).ready,true);
});

const fullPage=()=>Array.from({length:100},(_,i)=>({number:i+1,head:{ref:'feature/new-'+i}}));
test('oldest-first discovery reaches page two and deduplicates overlapping pages',async()=>{
 const routes=[];
 const inventory=await discoverOpenPullRequests('www-infinity4/QuantaPhi',async route=>{
  routes.push(route);
  return routes.length===1?fullPage():[{number:100},{number:101,head:{ref:'robot/TASK-1/388200123'}}];
 });
 assert.equal(inventory.complete,true);
 assert.equal(inventory.pagesRead,2);
 assert.equal(inventory.duplicateCount,1);
 assert.equal(inventory.pullRequests.length,101);
 assert.equal(inventory.pullRequests.at(-1).number,101);
 assert.match(routes[0],/sort=created&direction=asc&per_page=100&page=1$/);
 assert.match(routes[1],/page=2$/);
});

test('inventory cap and a failed later page retain explicit partial coverage',async()=>{
 let requests=0;
 const capped=await discoverOpenPullRequests('www-infinity4/QuantaPhi',async()=>{
  requests++;return fullPage();
 });
 assert.equal(requests,5,'bounded to five pages, even when upstream repeats them');
 assert.equal(capped.complete,false);
 assert.equal(capped.reason,'pr_inventory_limit_reached');
 assert.equal(capped.nextPage,6);
 assert.equal(capped.pullRequests.length,100);
 let page=0;
 const failed=await discoverOpenPullRequests('www-infinity4/QuantaPhi',async()=>{
  if(++page===2)throw Error('unavailable');
  return fullPage();
 });
 assert.equal(failed.complete,false);
 assert.equal(failed.reason,'pr_listing_unavailable');
 assert.equal(failed.pagesRead,1);
 assert.equal(failed.nextPage,2);
 assert.equal(failed.pullRequests.length,100);
});

test('malformed pages and invalid inventory limits never count as complete',async()=>{
 for(const rows of [{error:'denied'},[{number:0}],Array(101).fill({number:1})]){
  const inventory=await discoverOpenPullRequests('www-infinity4/QuantaPhi',async()=>rows);
  assert.equal(inventory.complete,false);
  assert.equal(inventory.reason,'pr_inventory_invalid');
  assert.equal(inventory.pagesRead,0);
 }
 await assert.rejects(discoverOpenPullRequests('other/QuantaPhi',async()=>[]),/invalid_pr_inventory/);
 await assert.rejects(discoverOpenPullRequests('www-infinity4/QuantaPhi',async()=>[],{maxPages:6}),/invalid_pr_inventory/);
});

function promotionFixture({checkResult={total_count:1,check_runs:checks},listingPages=[fullPage(),Array.from({length:6},(_,i)=>({
 number:101+i,head:{ref:'robot/TASK-1/388200123'}
}))]}={}){
 const calls=[],merges=[],runnerCalls=[];
 const readGithub=async(route,options)=>{
  calls.push(route);
  if(route.startsWith('user/repos?'))return [];
  if(route.includes('/pulls?state=open')){
   if(!route.startsWith('repos/www-infinity4/QuantaPhi/'))return [];
   return listingPages[Number(new URLSearchParams(route.split('?')[1]).get('page'))-1]||[];
  }
  const number=Number(route.match(/\/pulls\/(\d+)/)?.[1]);
  if(route.endsWith('/merge')){
   assert.equal(options.method,'PUT');
   assert.equal(options.body.sha,sha,'GitHub must enforce the exact inspected head');
   assert.equal(options.body.merge_method,'squash');
   merges.push(number);return {merged:true,sha:'b'.repeat(40)};
  }
  if(route.endsWith('/files?per_page=100'))return files;
  if(route.endsWith('/check-runs?per_page=100'))return checkResult;
  if(route.endsWith('/status'))return {statuses:[]};
  if(number)return {...candidate(),number,html_url:'https://github.com/www-infinity4/QuantaPhi/pull/'+number};
  throw Error('unexpected_test_route');
 };
 const callRunner=async(step,body)=>{runnerCalls.push({step,body});return {candidates:[],status:'merged_verified'};};
 return {calls,merges,runnerCalls,options:{token:'test-only',readGithub,callRunner}};
}

test('promotion processes page-two candidates and retains the four-merge cap',async()=>{
 const fixture=promotionFixture();
 const report=await runAutoPromotion(fixture.options);
 assert.deepEqual(fixture.merges,[101,102,103,104]);
 assert.equal(report.merged.length,4);
 assert.equal(report.prInventories[0].complete,true);
 assert.equal(report.prInventories[0].observed,106);
 assert.equal(fixture.runnerCalls.filter(call=>call.step==='merge-result').length,4);
});

test('partial or malformed check inventories cannot hide a failed or missing check',async()=>{
 for(const checkResult of [{total_count:2,check_runs:checks},{total_count:101,check_runs:checks},
  {check_runs:checks},{total_count:-1,check_runs:checks},{total_count:1,check_runs:null}]){
  const fixture=promotionFixture({checkResult,listingPages:[[{number:1,head:{ref:'robot/TASK-1/388200123'}}]]});
  const report=await runAutoPromotion(fixture.options);
  assert.equal(fixture.merges.length,0);
  assert.ok(report.deferred.some(row=>row.pr===1&&row.reason==='target_check_inventory_incomplete'));
 }
});

test('promotion reports a failed inventory page without claiming full coverage',async()=>{
 const fixture=promotionFixture({listingPages:[fullPage()]});
 const read=fixture.options.readGithub;
 fixture.options.readGithub=async(route,options)=>{
  if(route.startsWith('repos/www-infinity4/QuantaPhi/pulls?')&&route.endsWith('page=2'))throw Error('unavailable');
  return read(route,options);
 };
 const report=await runAutoPromotion(fixture.options);
 assert.equal(report.prInventories[0].complete,false);
 assert.equal(report.prInventories[0].pagesRead,1);
 assert.equal(report.prInventories[0].observed,100);
 assert.ok(report.deferred.some(row=>row.repository==='QuantaPhi'&&row.reason==='pr_listing_unavailable'&&row.nextPage===2));
 assert.equal(fixture.merges.length,0);
});
