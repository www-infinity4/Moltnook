import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLabProposal, summarizeLabEvidence} from './android-security-lab.mjs';
const sha='a'.repeat(64);
const fixture={
 target:{kind:'synthetic-fixture',packageId:'org.quantaphi.labfixture',apkSha256:sha},
 grant:{jobId:'issue:www-infinity4/QuantaPhi#1907',packageId:'org.quantaphi.labfixture',apkSha256:sha,expiresAtMs:1_900_000_100_000},
 observations:['call-counts','timing']
};
test('a fixture proposal passes data validation but cannot authorize itself',()=>{
 const result=validateLabProposal(fixture,{nowMs:1_900_000_000_000});
 assert.equal(result.valid,true);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.status,'requires-authenticated-signed-runner');
});
test('ordinary apps and missing grants fail closed',()=>{
 for(const candidate of [{...fixture,target:{...fixture.target,kind:'third-party-app'}},{...fixture,grant:null}]){
  const result=validateLabProposal(candidate,{nowMs:1_900_000_000_000});
  assert.equal(result.valid,false);
  assert.equal(result.executionAuthorized,false);
 }
});
test('wrong package, wrong APK hash, expired and overlong grants fail',()=>{
 const cases=[
  {...fixture,grant:{...fixture.grant,packageId:'com.other.app'}},
  {...fixture,grant:{...fixture.grant,apkSha256:'b'.repeat(64)}},
  {...fixture,grant:{...fixture.grant,expiresAtMs:1_899_999_999_999}},
  {...fixture,grant:{...fixture.grant,expiresAtMs:1_900_086_400_000}},
 ];
 for(const candidate of cases)assert.equal(validateLabProposal(candidate,{nowMs:1_900_000_000_000}).valid,false);
});
test('unapproved content-capture categories fail before any tool execution',()=>{
 for(const observations of [['call-counts','plaintext-payload'],['credentials'],[]]){
  assert.equal(validateLabProposal({...fixture,observations},{nowMs:1_900_000_000_000}).valid,false);
 }
});
test('strict metadata evidence has no payloads, raw logs or secret strings',()=>{
 const items=[{id:'test-1',stage:'trace',anchor:'fixture/src/Main.java:44',kind:'call-counts',count:3,testPassed:true}];
 const summary=summarizeLabEvidence(items,{unknowns:['trace-case-2']});
 assert.equal(summary.status,'unverified-structured-summary');
 assert.equal(summary.evidenceCount,1);
 assert.equal(summary.residualUnknowns,1);
 assert.equal(summary.releaseReady,false);
 assert.ok(!('rawEvents' in summary));
 for(const bad of [{...items[0],payload:'password=oops'},{...items[0],rawTrace:'secret'},{...items[0],kind:'raw-traffic'}]){
  assert.throws(()=>summarizeLabEvidence([bad]),/metadata-only/);
 }
});
test('unaddressed or duplicate evidence is rejected instead of inflating results',()=>{
 const item={id:'test-1',stage:'verify',anchor:'fixture/tests/security.test.mjs:4',kind:'test-result',count:1,testPassed:true};
 assert.throws(()=>summarizeLabEvidence([item,item]),/duplicate/);
 assert.throws(()=>summarizeLabEvidence([{...item,anchor:'some unsupported claim'}]),/anchor/);
});
test('social-post pass counts and missing test receipts cannot turn a summary into release evidence',()=>{
 const summary=summarizeLabEvidence([],{unknowns:[],claimedPasses:133,reviewer:'agent-2'});
 assert.equal(summary.releaseReady,false);
 assert.equal(summary.evidenceCount,0);
 assert.equal(summary.independentReviewVerified,false);
});
