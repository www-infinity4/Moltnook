import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBrowserObservations} from './browser-observation-gate.mjs';
const sites=[{repository:'www-infinity4/QuantaPhi',linkFacts:[{id:'shoplcShirtButton'}]},{repository:'www-infinity4/Omni-Phi'}];
const good=()=>[{repository:'www-infinity4/QuantaPhi',browserPassed:true,readOnlyControlChecks:[
 {device:'mobile',passed:true,controls:[{id:'shoplcShirtButton',verified:true}]},
 {device:'desktop',passed:true,controls:[{id:'shoplcShirtButton',verified:true}]}]},
 {repository:'www-infinity4/Omni-Phi',browserPassed:true,readOnlyControlChecks:[]}];
test('green requires named live control matched on mobile and desktop',()=>{
 const r=assessBrowserObservations(good(),sites);
 assert.equal(r.passed,true);assert.equal(r.status,'public_browser_passed');assert.deepEqual(r.failures,[]);
});
test('a dead button fails observer despite healthy pages and screenshots',()=>{
 const checks=good();checks[0].readOnlyControlChecks[0].controls[0].verified=false;
 const r=assessBrowserObservations(checks,sites);
 assert.equal(r.status,'public_browser_failed');assert.equal(r.failures[0].selector,'#shoplcShirtButton');assert.equal(r.failures[0].device,'mobile');
});
test('missing probe and missing page both fail closed',()=>{
 const checks=good();checks[0].readOnlyControlChecks=[];checks[1].browserPassed=false;
 const r=assessBrowserObservations(checks,sites);
 assert.equal(r.passed,false);assert.equal(r.failures.length,3);
});
test('unconfigured observer cannot falsely pass',()=>{
 assert.throws(()=>assessBrowserObservations([],[]));
});
