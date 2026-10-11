import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveFeatureManifest} from './feature-manifest.mjs';
const link={id:'shoplcShirtButton',sourcePath:'index.html',label:'ShopLC Live channel',href:'https://quantaphi.org/shoplc/'};
test('derive bounded ShopLC manifest from pinned source, not owner imagination',()=>{
 const receipt={status:'public_browser_passed',targets:[{url:'https://quantaphi.org/shoplc/',views:[{passed:true,httpStatus:200,screenshotPath:'repository-receipts/live-browser-before/linked-2-mobile.png'}]}]};
 const m=deriveFeatureManifest({repository:'www-infinity4/QuantaPhi',linkFacts:[link],liveBrowser:receipt});
 assert.equal(m.status,'source_derived_unverified');assert.equal(m.checks.length,1);
 assert.equal(m.checks[0].selector,'#shoplcShirtButton');
 assert.equal(m.checks[0].targetURL,'https://quantaphi.org/shoplc/');
 assert.equal(m.checks[0].verified.destinationPublicLoad,true);
 assert.equal(m.checks[0].verified.controlDOM,'not_checked');
 assert.equal(m.checks[0].verified.deploymentVersion,'not_checked');
 assert.equal(m.artifactDirectory,'repository-receipts/');
 assert.equal(m.manifestProvidedByOwner,false);
});
test('untrusted targets cannot become manifest entries',()=>{
 const rows=[{...link,href:'https://evil.com/'},{...link,href:'javascript:alert(1)'},{...link,id:'x] button'},{...link,href:'//evil.com/'}];
 const m=deriveFeatureManifest({repository:'www-infinity4/QuantaPhi',linkFacts:rows});
 assert.deepEqual(m.checks,[]);
 assert.equal(m.status,'no_safe_source_controls');
});
test('failed browser response cannot be marked validated and protected scope is unsupported',()=>{
 const browser={status:'public_browser_failed',targets:[{url:'https://quantaphi.org/shoplc/',views:[{passed:false,httpStatus:404}]}]};
 const a=deriveFeatureManifest({repository:'www-infinity4/QuantaPhi',linkFacts:[link],liveBrowser:browser});
 assert.equal(a.checks[0].verified.destinationPublicLoad,false);
 assert.equal(a.status,'source_derived_unverified');
 const b=deriveFeatureManifest({repository:'www-infinity4/Unrelated',linkFacts:[link],liveBrowser:browser});
 assert.equal(b.checks.length,0);
});
