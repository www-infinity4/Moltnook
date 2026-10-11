import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTrustedTicket,patchTrustedShopLC,dispatchDraftRepair} from './repair-draft-dispatch.mjs';

const SHA='a'.repeat(40);
const expected='https://quantaphi.org/shoplc/';
const wrong='https://quantaphi.org/broken/';
const id='browser-repair-'+'3'.repeat(24);
function ticket(){
 return {schemaVersion:1,id,task:'INSPECT_BROKEN_CONTROL',failureDetails:{repository:'www-infinity4/QuantaPhi',selector:'#shoplcShirtButton',device:'mobile',expectedHref:expected,actualHref:wrong},
  sourceLookup:{status:'unique_candidate',baseSha:SHA,matches:[{path:'index.html',line:25,kind:'static-markup-definition'}]},
  evidence:{runUrl:'https://github.com/www-infinity4/Moltnook/actions/runs/38104756503'}};
}
function issue(payload=ticket()){
 const fence=String.fromCharCode(96).repeat(3);
 return {number:83,title:'[Agent Job] Browser repair www-infinity4/QuantaPhi #shoplcShirtButton',body:'<!-- '+payload.id+' -->\n'+fence+'json\n'+JSON.stringify(payload)+'\n'+fence,html_url:'https://github.com/www-infinity4/Oracle-Octaves/issues/83'};
}
const wrongSource='<html><a class="shoplcShirtButton inPageSite" id="shoplcShirtButton" href="'+wrong+'" data-site-url="'+wrong+'"><span>ShopLC</span><span>Live channel</span></a></html>';
test('intake must be exact vetted repository, selector, source SHA and stable evidence',()=>{
 const parsed=parseTrustedTicket(issue());
 assert.equal(parsed.issueNumber,83);assert.equal(parsed.branch,'repair/browser-'+'3'.repeat(24));
 assert.equal(parseTrustedTicket(issue({...ticket(),failureDetails:{...ticket().failureDetails,repository:'attacker/repo'}})),null);
 assert.equal(parseTrustedTicket(issue({...ticket(),failureDetails:{...ticket().failureDetails,expectedHref:'https://attacker.invalid'}})),null);
 assert.equal(parseTrustedTicket(issue({...ticket(),sourceLookup:{...ticket().sourceLookup,status:'ambiguous'}})),null);
 assert.equal(parseTrustedTicket(issue({...ticket(),evidence:{runUrl:'https://evil.com/not-real'}})),null);
 assert.equal(parseTrustedTicket({...issue(),body:'no signed-like marker'}),null);
});
test('repairs exactly one static ShopLC tag, including data-site-url, without executing strings',()=>{
 const p=parseTrustedTicket(issue());
 const result=patchTrustedShopLC(wrongSource,p);
 assert.equal(result.path,'index.html');assert.equal(result.from,wrong);assert.equal(result.to,expected);
 assert.equal(result.content.includes('href="'+expected+'"'),true);
 assert.equal(result.content.includes('data-site-url="'+expected+'"'),true);
 assert.equal(result.content.includes(wrong),false);
 assert.throws(()=>patchTrustedShopLC(result.content,p),/already has desired href/);
 assert.throws(()=>patchTrustedShopLC(wrongSource+wrongSource,p),/exactly one static anchor/);
 assert.throws(()=>patchTrustedShopLC(wrongSource.replaceAll(wrong,'https://quantaphi.org/something-else/'),p),/disagree/);
 assert.throws(()=>patchTrustedShopLC(wrongSource.replace('id="shoplcShirtButton"','id="other"'),p));
});
function mockGitHub({sha=SHA,source=wrongSource,prs=[],protectedMain=true}={}){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  const pathname=new URL(url).pathname;const method=opts.method||'GET';calls.push({pathname,method,body:opts.body?JSON.parse(opts.body):null});
  let data;
  if(pathname.endsWith('/branches/main'))data={protected:protectedMain};
  else if(pathname.endsWith('/git/ref/heads/main'))data={object:{sha}};
  else if(pathname.endsWith('/contents/index.html')&&method==='GET')data={sha:'blobsha',encoding:'base64',content:Buffer.from(source).toString('base64')};
  else if(pathname.endsWith('/pulls')&&method==='GET')data=prs;
  else if(pathname.endsWith('/git/refs')&&method==='POST')data={ref:opts.body?JSON.parse(opts.body).ref:null};
  else if(pathname.endsWith('/contents/index.html')&&method==='PUT')data={commit:{sha:'b'.repeat(40)}};
  else if(pathname.endsWith('/pulls')&&method==='POST')data={number:91,html_url:'https://github.com/www-infinity4/QuantaPhi/pull/91'};
  else throw Error('Unexpected API '+method+' '+pathname);
  return {ok:true,json:async()=>data};
 };
 return {fetchImpl,calls};
}
test('dry-run fetches pinned source and existing PRs but cannot write',async()=>{
 const fake=mockGitHub();
 const r=await dispatchDraftRepair(parseTrustedTicket(issue()),{dryRun:true,fetchImpl:fake.fetchImpl});
 assert.equal(r.status,'dry_run_candidate');
 assert.deepEqual(fake.calls.map(x=>x.method),['GET','GET','GET','GET']);
 assert.equal(fake.calls.some(x=>/main$/.test(x.pathname)&&x.method!=='GET'),false);
});
test('app token creates one branch, one targeted content commit and draft PR—never main',async()=>{
 const fake=mockGitHub();
 const r=await dispatchDraftRepair(parseTrustedTicket(issue()),{token:'fixture_restricted_app_token_123456',fetchImpl:fake.fetchImpl});
 assert.equal(r.status,'draft_pr_created');assert.equal(r.prNumber,91);
 assert.deepEqual(fake.calls.map(x=>x.method),['GET','GET','GET','GET','POST','PUT','POST']);
 const branch=fake.calls[4].body,put=fake.calls[5].body,pr=fake.calls[6].body;
 assert.equal(branch.sha,SHA);assert.equal(branch.ref,'refs/heads/repair/browser-'+'3'.repeat(24));
 assert.equal(put.branch,'repair/browser-'+'3'.repeat(24));assert.ok(!put.branch.includes('main'));
 assert.equal(Buffer.from(put.content,'base64').toString('utf8').includes(expected),true);
 assert.equal(pr.draft,true);assert.equal(pr.base,'main');assert.equal(pr.head,put.branch);
 assert.ok(!fake.calls.some(x=>x.method==='PUT'&&x.body?.branch==='main'));
});
test('stale source, already correct source, duplicate PR or absent token cause no writes',async()=>{
 for(const variant of [{protectedMain:false},{sha:'c'.repeat(40)},{source:wrongSource.replaceAll(wrong,expected)},{prs:[{html_url:'https://github.com/www-infinity4/QuantaPhi/pull/91'}]}]){
  const fake=mockGitHub(variant);
  const r=await dispatchDraftRepair(parseTrustedTicket(issue()),{token:'fixture_restricted_app_token_123456',fetchImpl:fake.fetchImpl});
  assert.equal(['blocked','existing_draft_or_pr'].includes(r.status),true);
  assert.equal(fake.calls.some(x=>x.method==='POST'||x.method==='PUT'),false);
 }
 const fake=mockGitHub();
 const r=await dispatchDraftRepair(parseTrustedTicket(issue()),{fetchImpl:fake.fetchImpl});
 assert.equal(r.status,'blocked');assert.equal(fake.calls.length,0);
});

test('an unprotected main branch prevents any automated branch write even with an App token',async()=>{
 const fake=mockGitHub({protectedMain:false});
 const r=await dispatchDraftRepair(parseTrustedTicket(issue()),{token:'fixture_restricted_app_token_123456',fetchImpl:fake.fetchImpl});
 assert.equal(r.status,'blocked');
 assert.match(r.reason,/unprotected/);
 assert.deepEqual(fake.calls.map(x=>x.method),['GET']);
});
