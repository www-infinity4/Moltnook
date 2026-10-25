import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyRepositoryIdentity as verify} from './repository-identity.mjs';
const target='www-infinity4/QuantaPhi';
const good=()=>({id:1380883643,full_name:target,name:'QuantaPhi',owner:{login:'www-infinity4'},default_branch:'main',permissions:{push:true}});
test('exact API identity does not claim a write or deployment',()=>{
 assert.deepEqual(verify(target,good()),{repository:target,repositoryId:1380883643,owner:'www-infinity4',defaultBranch:'main',metadataVerified:true,writeExecuted:false,deploymentVerified:false});
});
test('www. cannot substitute for www- even with reported push permission',()=>{
 const wrong='www.infinity4/QuantaPhi';
 assert.throws(()=>verify(wrong,{...good(),full_name:wrong,owner:{login:'www.infinity4'}}),/scope_mismatch/);
 for(const meta of [{...good(),full_name:wrong},{...good(),owner:{login:'www.infinity4'}},{...good(),id:123},{...good(),name:'Other'},null])
  assert.throws(()=>verify(target,meta),/metadata_mismatch/);
});
test('missing API identity and branch fail closed',()=>{
 for(const id of [0,'1380883643',undefined])assert.throws(()=>verify(target,{...good(),id}),/metadata_mismatch/);
 assert.throws(()=>verify(target,{...good(),default_branch:''}),/default_branch_missing/);
});
test('production runner verifies API metadata before clone or source review',()=>{
 const source=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
 const check=source.indexOf('report.repositoryIdentity=verifyRepositoryIdentity(report.repository,repo)');
 assert.ok(check>source.indexOf("const repo=await github('repos/'+report.repository)"));
 assert.ok(check<source.indexOf("command('git',['clone'"));
 assert.ok(check<source.indexOf('await runSourceReview('));
});
