// Scheduled public browser smoke; independent of any writer lease or wallet identity.
import fs from 'node:fs/promises';
import {verifyLiveBrowser} from './live-browser.mjs';
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
const report={schemaVersion:1,when:new Date().toISOString(),status:checks.every(x=>x.browserPassed)?'public_browser_passed':'public_browser_failed',checks,
 note:'Anonymous GET/HEAD-only browser checks. Source version, publisher identity, wallet transactions, AI responses and real user acceptance are not verified.'};
await fs.mkdir('repository-receipts',{recursive:true});
await fs.writeFile('repository-receipts/public-live-browser.json',JSON.stringify(report,null,2));
if(report.status!=='public_browser_passed')process.exitCode=1;
