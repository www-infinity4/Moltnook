import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBrowserObservations} from '../agents/repository-engine/browser-observation-gate.mjs';
import {payloadsFromReport} from './automated-repair-handler.mjs';
import {parseTrustedTicket,dispatchDraftRepair} from './repair-draft-dispatch.mjs';

test('mock broken mobile ShopLC control becomes an evidence-linked draft PR without touching main',async()=>{
 const expected='https://quantaphi.org/shoplc/',actual='https://quantaphi.org/broken/';
 const site={repository:'www-infinity4/QuantaPhi',linkFacts:[{id:'shoplcShirtButton',href:expected,sourcePath:'index.html'}]};
 const checks=[{repository:site.repository,browserPassed:true,readOnlyControlChecks:[
  {device:'mobile',controls:[{id:'shoplcShirtButton',verified:false,actualHref:actual}]},
  {device:'desktop',controls:[{id:'shoplcShirtButton',verified:true,actualHref:expected}]}
 ],targets:[{views:[{device:'mobile',screenshotPath:'repository-receipts/public-live-browser/fixture-mobile.png'}]}]}];
 const assessment=assessBrowserObservations(checks,[site]);
 assert.equal(assessment.passed,false);
 assert.equal(assessment.failures[0].expectedHref,expected);
 assert.equal(assessment.failures[0].actualHref,actual);
 const report={schemaVersion:1,assessment,checks};
 const [payload]=payloadsFromReport(report,'https://github.com/www-infinity4/Moltnook/actions/runs/38104756503');
 assert.equal(payload.failureDetails.actualHref,actual);
 assert.equal(payload.failureDetails.expectedHref,expected);
 assert.deepEqual(payload.failureDetails.screenshots,['repository-receipts/public-live-browser/fixture-mobile.png']);
 const sha='a'.repeat(40);
 payload.sourceLookup={status:'unique_candidate',baseSha:sha,matches:[{path:'index.html',line:1}]};
 const fence=String.fromCharCode(96).repeat(3);
 const issue={number:27,html_url:'https://github.com/www-infinity4/Oracle-Octaves/issues/27',title:'[Agent Job] Browser repair www-infinity4/QuantaPhi #shoplcShirtButton',body:'<!-- '+payload.id+' -->\n'+fence+'json\n'+JSON.stringify(payload)+'\n'+fence};
 const candidate=parseTrustedTicket(issue);
 assert.ok(candidate);
 const source='<a id="shoplcShirtButton" href="'+actual+'" data-site-url="'+actual+'">ShopLC Live channel</a>';
 const calls=[];
 const fetchImpl=async(url,options)=>{
  const u=new URL(url),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
  calls.push({url:u.href,method,body});
  if(u.pathname.endsWith('/git/ref/heads/main'))return {ok:true,json:async()=>({object:{sha}})};
  if(u.pathname.endsWith('/contents/index.html')&&method==='GET')return {ok:true,json:async()=>({sha:'blob',encoding:'base64',content:Buffer.from(source).toString('base64')})};
  if(u.pathname.endsWith('/pulls')&&method==='GET')return {ok:true,json:async()=>([])};
  if(u.pathname.endsWith('/git/refs')&&method==='POST')return {ok:true,json:async()=>({ref:body.ref})};
  if(u.pathname.endsWith('/contents/index.html')&&method==='PUT')return {ok:true,json:async()=>({commit:{sha:'b'.repeat(40)}})};
  if(u.pathname.endsWith('/pulls')&&method==='POST')return {ok:true,json:async()=>({number:33,html_url:'https://github.com/www-infinity4/QuantaPhi/pull/33'})};
  throw Error('Unexpected request '+method+' '+u.pathname);
 };
 const result=await dispatchDraftRepair(candidate,{token:'fixture_scoped_app_token_123456',fetchImpl});
 assert.equal(result.status,'draft_pr_created');
 assert.equal(result.prNumber,33);
 assert.deepEqual(calls.map(x=>x.method),['GET','GET','GET','POST','PUT','POST']);
 const changes=calls.filter(x=>x.method==='POST'||x.method==='PUT');
 assert.equal(changes.length,3);
 assert.equal(changes[0].body.ref.startsWith('refs/heads/repair/browser-'),true);
 assert.equal(changes[1].body.branch.startsWith('repair/browser-'),true);
 assert.equal(changes[2].body.draft,true);
 assert.equal(changes[2].body.base,'main');
 assert.ok(!changes.some(x=>x.body?.branch==='main'||x.body?.ref==='refs/heads/main'));
});
