import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewGate,checkGate,finalize} from './repair-finalize.mjs';
import {rewriteDeployedHTML} from './repair-finalize-edge.mjs';
const base='a'.repeat(40),head='b'.repeat(40),merge='c'.repeat(40);
const branch='repair/browser-'+ 'd'.repeat(24);
const original='<a id="shoplcShirtButton" href="https://quantaphi.org/wrong/">Shop</a>';
const fixed=original.replace('wrong/','shoplc/');
const proposal={baseSha:base,branch,ticket:{failureDetails:{actualHref:'https://quantaphi.org/wrong/'}}};
const pr={number:42,node_id:'id',state:'open',draft:false,mergeable:true,user:{login:'infinity-quantaphi-repair-bot[bot]'},head:{sha:head,ref:branch,repo:{full_name:'www-infinity4/QuantaPhi'}},base:{ref:'main',repo:{full_name:'www-infinity4/QuantaPhi'}}};
const approved=[{state:'APPROVED',commit_id:head,user:{login:'www-infinity4'}}];
function mock(overrides={}){
 const calls=[],browserCalls=[];
 const fetchImpl=async(url,options={})=>{
  const p=new URL(url).pathname+new URL(url).search;calls.push({p,...options});
  let value;
  if(p.includes('/contents/')){const ref=new URL(url).searchParams.get('ref');value={encoding:'base64',content:Buffer.from(ref===base?original:(overrides.source||fixed)).toString('base64')};}
  else if(p.includes('/compare/'))value=overrides.diff||{status:'ahead',ahead_by:1,commits:[{sha:head,parents:[{sha:base}]}],files:[{filename:'index.html',status:'modified'}]};
  else if(p.endsWith('/branches/main'))value={protected:overrides.protected??true,commit:{sha:overrides.main||base}};
  else if(p.includes('/reviews?'))value=overrides.reviews||approved;
  else if(p.includes('/check-runs?'))value=overrides.checks||{total_count:1,check_runs:[{head_sha:head,status:'completed',conclusion:'success'}]};
  else if(p.endsWith('/status'))value=overrides.statuses||{total_count:0,statuses:[],state:'pending'};
  else if(p.endsWith('/merge'))value={merged:true,sha:merge};
  else if(p.endsWith('/pulls/42'))value=overrides.latest||pr;
  else if(p==='/graphql')value={data:{markPullRequestReadyForReview:{pullRequest:{number:42}}}};
  else throw Error('Unexpected request '+p);
  return {ok:true,json:async()=>value};
 };
 const browserCheck=async(args)=>{browserCalls.push(args);if(overrides.deploymentFailure&&!args.preview)throw Error('Deployment stale');return {passed:true,mode:args.preview?'staged_preview':'deployed'};};
 return {calls,browserCalls,fetchImpl,browserCheck,token:'test-token-not-a-real-secret',dryRun:false};
}
test('review requires owner approval on exact head and respects later rejections/dismissal',()=>{
 assert.equal(reviewGate(approved,head),true);
 for(const reviews of [[],[{...approved[0],commit_id:base}],[{...approved[0],user:{login:'attacker'}}],[...approved,{...approved[0],state:'DISMISSED'}],[...approved,{state:'CHANGES_REQUESTED',user:{login:'reviewer'}}]])assert.equal(reviewGate(reviews,head),false);
});
test('check gate rejects pending, failed, stale and truncated evidence',()=>{
 for(const c of [{total_count:1,check_runs:[]},{total_count:1,check_runs:[{head_sha:head,status:'queued'}]},{total_count:1,check_runs:[{head_sha:head,status:'completed',conclusion:'failure'}]},{total_count:1,check_runs:[{head_sha:base,status:'completed',conclusion:'success'}]}])assert.equal(checkGate(c,head),false);
});
test('dry-run validates exact patch and never writes or launches browser',async()=>{
 const m=mock();assert.equal((await finalize(pr,proposal,{...m,dryRun:true})).status,'validated_candidate');assert.equal(m.browserCalls.length,0);assert.equal(m.calls.some(c=>c.method!=='GET'),false);
});
test('foreign author, source tampering and extra changed files refuse writes',async()=>{
 const foreign=mock();await assert.rejects(finalize({...pr,user:{login:'attacker'}},proposal,foreign));assert.equal(foreign.calls.length,0);
 for(const changes of [{source:fixed+'<script>evil()</script>'},{diff:{status:'ahead',ahead_by:2} }]){const m=mock(changes);await assert.rejects(finalize(pr,proposal,m));assert.equal(m.calls.some(c=>c.method!=='GET'),false);}
});
test('unprotected or stale main refuses merge',async()=>{
 for(const o of [{protected:false},{main:head}]){const m=mock(o);assert.equal((await finalize(pr,proposal,m)).status,'blocked');assert.equal(m.calls.some(c=>c.method!=='GET'),false);}
});
test('validated draft becomes ready but unreviewed patch cannot merge',async()=>{
 const m=mock({reviews:[]});const r=await finalize({...pr,draft:true},proposal,m);assert.equal(r.status,'waiting_review');assert.equal(m.calls.filter(c=>c.method==='POST').length,1);assert.equal(m.calls.some(c=>c.method==='PUT'),false);
});
test('pending checks or last-second SHA changes block merge',async()=>{
 for(const o of [{checks:{total_count:1,check_runs:[]}},{statuses:{total_count:1,statuses:[{}],state:'failure'}},{latest:{...pr,head:{...pr.head,sha:merge}}}]){const m=mock(o);const r=await finalize(pr,proposal,m);assert.ok(['waiting_checks','blocked'].includes(r.status));assert.equal(m.calls.some(c=>c.method==='PUT'),false);}
});
test('approved checked exact patch merges with SHA guard, then verifies deployed browser',async()=>{
 const m=mock();const r=await finalize(pr,proposal,m);assert.equal(r.status,'deployed_verified');assert.equal(r.commitSha,merge);const write=m.calls.find(c=>c.method==='PUT');assert.deepEqual(JSON.parse(write.body),{sha:head,merge_method:'merge'});assert.deepEqual(m.browserCalls.map(c=>c.preview),[true,false]);assert.ok(!m.calls.find(c=>c.p.includes('check-runs')).headers.Authorization);
});
test('merge success with stale deployment stays unverified and can be resumed',async()=>{
 const m=mock({deploymentFailure:true});assert.equal((await finalize(pr,proposal,m)).status,'merged_unverified');
 const next=mock();assert.equal((await finalize({...pr,state:'closed',merged_at:'now',merge_commit_sha:merge},proposal,next)).status,'deployed_verified');assert.equal(next.calls.some(c=>c.method!=='GET'),false);
});
test('delivery transform preserves legacy wallet bridge while rewriting suite links',()=>{
 const bridge='https://www-infinity4.github.io/QuantaPhi/wallet-link.html';
 assert.equal(rewriteDeployedHTML(bridge),bridge);
 assert.equal(rewriteDeployedHTML('https://www-infinity4.github.io/ShopLC/'), 'https://quantaphi.org/shoplc/');
 assert.equal(rewriteDeployedHTML('https://www-infinity4.github.io/QuantaPhi/'), 'https://quantaphi.org/');
});
test('delivery transform leaves the approved ShopLC correction and unrelated content intact',()=>{
 assert.equal(rewriteDeployedHTML(fixed),fixed);
 assert.notEqual(rewriteDeployedHTML(fixed+'unexpected'),rewriteDeployedHTML(fixed));
});
