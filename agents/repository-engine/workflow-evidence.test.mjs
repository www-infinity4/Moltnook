import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {safePath} from './patch.mjs';
import {readWorkflowEvidence} from './workflow-evidence.mjs';
import {collectSourceEvidence} from './source-evidence.mjs';
test('workflow evidence is inspected with strict read-only boundaries and credential line redaction',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'infinity-workflow-evidence-'));
 try{
  await fs.mkdir(path.join(root,'.github','workflows'),{recursive:true});
  await fs.writeFile(path.join(root,'.github','workflows','robot.yml'),'name: Robot Tests\non: [push]\npermissions: {contents: read}\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node --test test/robot.test.mjs\n      - env: {TOKEN: ${{ secrets.REPOSITORY_TOKEN }}}\n');
  const seen=[],result=await collectSourceEvidence({paths:['.github/workflows/robot.yml','.github/workflows/../steal.yml','.github/secrets/foo.yml','.env'],task:'Robot scoped runner workflow and CI permissions',read:async p=>{seen.push(p);return '';},readWorkflow:p=>readWorkflowEvidence(root,p)});
  assert.ok(result['.github/workflows/robot.yml']);assert.match(result['.github/workflows/robot.yml'],/Robot Tests/);
  assert.ok(!JSON.stringify(result).includes('REPOSITORY_TOKEN'));
  assert.ok(!seen.includes('.github/workflows/robot.yml'));
  assert.equal(safePath('.github/workflows/robot.yml'),'.github/workflows/robot.yml');
  for(const file of ['.github/workflows/../steal.yml','.github/secrets/private.yml','/tmp/x.yml','.github/workflows/hi.yaml/extra']){
   await assert.rejects(()=>readWorkflowEvidence(root,file));
  }
  await fs.symlink(path.join(root,'.env'),path.join(root,'.github','workflows','link.yml'));
  await assert.rejects(()=>readWorkflowEvidence(root,'.github/workflows/link.yml'));
  await assert.rejects(()=>readWorkflowEvidence(root,'.github/workflows/robot.yml',{maxBytes:30}));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('ordinary shop planning never reads workflows, even if available',async()=>{
 let workflowRead=false;
 const result=await collectSourceEvidence({paths:['index.html','.github/workflows/deploy.yml'],task:'Fix a broken shop link',read:async p=>'<a href="/shop">Shop</a>',readWorkflow:async()=>{workflowRead=true;return 'should not read';}});
 assert.equal(workflowRead,false);assert.match(result['index.html'],/shop/);
});
