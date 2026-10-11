import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {locateSelectorFiles,selectorMatcher,payloadsFromReport,dispatchToRepairEngine} from './automated-repair-handler.mjs';
test('locates markup definitions, flags ambiguity, excludes credentials and symlinks',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'selector-test-'));
 try{
  await fs.writeFile(path.join(root,'index.html'),'<a id="target" class="other target" data-action="open">Open</a>');
  await fs.writeFile(path.join(root,'.env'),'<a id="target">secret</a>');
  await fs.symlink(path.join(root,'index.html'),path.join(root,'link.html'));
  assert.equal((await locateSelectorFiles(root,'#target')).status,'unique_candidate');
  assert.equal((await locateSelectorFiles(root,'.target')).matches[0].path,'index.html');
  assert.equal((await locateSelectorFiles(root,'[data-action="open"]')).status,'unique_candidate');
  await fs.writeFile(path.join(root,'other.tsx'),'<a id="target"/>');
  assert.equal((await locateSelectorFiles(root,'#target')).status,'ambiguous');
  assert.equal((await locateSelectorFiles(root,'#missing')).status,'not_found');
  assert.throws(()=>selectorMatcher('a > #target'));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
const report={schemaVersion:1,assessment:{failures:[{repository:'www-infinity4/QuantaPhi',selector:'#target',device:'mobile',reason:'mismatch',expectedHref:'/shoplc/'}]},checks:[{repository:'www-infinity4/QuantaPhi',readOnlyControlChecks:[{device:'mobile',controls:[{id:'target',actualHref:'/wrong/'}]}],targets:[{views:[{device:'mobile',screenshotPath:'repository-receipts/public-live-browser/mobile.png'}]}]}]};
test('preserves failure evidence with stable deduplication and no guessed expected href',()=>{
 const [a]=payloadsFromReport(report),[b]=payloadsFromReport(report);assert.equal(a.id,b.id);
 assert.equal(a.failureDetails.actualHref,'/wrong/');assert.equal(a.failureDetails.expectedHref,'/shoplc/');
 assert.equal(a.failureDetails.screenshots.length,1);
 const copy=structuredClone(report);delete copy.assessment.failures[0].expectedHref;
 assert.equal(payloadsFromReport(copy)[0].failureDetails.expectedHref,null);
 copy.assessment.failures[0].repository='attacker/repo';assert.throws(()=>payloadsFromReport(copy));
});
test('missing credential is blocked, real issue receipt is required, retries deduplicate',async()=>{
 const [payload]=payloadsFromReport(report);
 assert.equal((await dispatchToRepairEngine(payload)).status,'BLOCKED');
 let calls=0;
 const fetchImpl=async(url,opts)=>{calls++;return {ok:true,json:async()=>opts.method==='POST'?{number:7,html_url:'https://github.com/www-infinity4/Oracle-Octaves/issues/7'}:[]};};
 const result=await dispatchToRepairEngine(payload,{token:'fixture',fetchImpl});assert.equal(result.status,'TICKET_CREATED');assert.equal(result.executorQueued,false);assert.equal(calls,2);
 const existing=await dispatchToRepairEngine(payload,{token:'fixture',fetchImpl:async()=>({ok:true,json:async()=>[{body:'<!-- '+payload.id+' -->',html_url:result.url,state:'closed'}]})});
 assert.equal(existing.status,'EXISTING_TICKET');assert.equal(existing.state,'closed');
 await assert.rejects(()=>dispatchToRepairEngine(payload,{token:'fixture',fetchImpl:async()=>({ok:false,status:403})}),/403/);
});
