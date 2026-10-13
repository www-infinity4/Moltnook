// Scheduled public browser smoke; independent of any writer lease or wallet identity.
import fs from 'node:fs/promises';
import {verifyLiveBrowser} from './live-browser.mjs';
import {inspectServiceFeatures} from './service-feature-checks.mjs';
import {assessBrowserObservations} from './browser-observation-gate.mjs';
const sites=[
 {repository:'www-infinity4/QuantaPhi',linkFacts:[{id:'shoplcShirtButton',href:'https://quantaphi.org/shoplc/',sourcePath:'index.html'}]},
 {repository:'www-infinity4/Omni-Phi'},
 {repository:'www-infinity4/News-Phi'},
 {repository:'www-infinity4/ShopLC'}
];
const checks=[];
for(const site of sites){
 const result=await verifyLiveBrowser({...site,directory:'repository-receipts/public-live-browser/'+site.repository.split('/')[1]});
 checks.push(result);
 console.log(site.repository+': '+result.status+' ('+result.targets.map(t=>t.url).join(', ')+')');
}
const assessment=assessBrowserObservations(checks,sites);
const serviceFailures=await inspectServiceFeatures();
assessment.failures.push(...serviceFailures);if(serviceFailures.length){assessment.status='public_browser_failed';assessment.passed=false;}
for(const problem of assessment.failures)console.error('Live observer failed: '+problem.repository+' '+(problem.selector||'page')+' '+(problem.device||'')+' '+problem.reason);
const report={schemaVersion:1,when:new Date().toISOString(),status:assessment.status,assessment,checks,
 note:'Anonymous GET/HEAD-only browser checks. Source version, publisher identity, wallet transactions, AI responses and real user acceptance are not verified.'};
await fs.mkdir('repository-receipts',{recursive:true});
await fs.writeFile('repository-receipts/public-live-browser.json',JSON.stringify(report,null,2));
if(report.status!=='public_browser_passed')process.exitCode=1;
