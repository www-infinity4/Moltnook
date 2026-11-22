import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetModelEvidence,MODEL_EVIDENCE_LIMIT} from './model-evidence-budget.mjs';

test('overlong reader inventory is made small enough for Brain without losing owner task or pinned source evidence',()=>{
 const sha='a'.repeat(40);
 const task='Repair agents/repository-engine/runner.mjs Green source writer';
 const paths=Array.from({length:1800},(_,i)=>'archive/path-'+i+'/very-long-repeated-ui-component-'+i+'.mjs');
 paths.push('agents/repository-engine/runner.mjs');
 const evidence={task,baseSha:sha,tree:paths,sourceSamples:{'agents/repository-engine/runner.mjs':'function writer(){}'},
  dependencyContext:{repositories:[{repository:'www-infinity4/QuantaPhi',commitSha:sha,tree:paths,files:[{path:'docs/OWNER.md',blobSha:sha,status:'verified_source',excerpt:'Verified requirements'}]}]},
  agents:'Rules must remain in effect.\n'.repeat(1000),readme:'README\n'.repeat(1800)};
 const original=structuredClone(evidence);
 const bounded=budgetModelEvidence(evidence);
 assert.ok(JSON.stringify(bounded).length<=MODEL_EVIDENCE_LIMIT);
 assert.equal(bounded.task,task);
 assert.equal(bounded.baseSha,sha);
 assert.ok(bounded.tree.includes('agents/repository-engine/runner.mjs'));
 assert.deepEqual(bounded.sourceSamples,evidence.sourceSamples);
 assert.deepEqual(bounded.dependencyContext.repositories[0].files,evidence.dependencyContext.repositories[0].files);
 assert.equal(bounded.dependencyContext.repositories[0].commitSha,sha);
 assert.deepEqual(evidence,original,'the original signed evidence must not be mutated');
 assert.ok(bounded.evidenceBudget.reductions.length>0);
});

test('under-limit evidence passes through unchanged without summarizing exact code',()=>{
 const evidence={baseSha:'b'.repeat(40),source:{'file.js':{sha256:'xyz',windows:[{text:'const x=1;'}]}},edits:[{path:'file.js',before:'x',after:'y'}]};
 assert.equal(budgetModelEvidence(evidence),evidence);
});

test('exact source, edits, lease and tested outcomes are never silently truncated',()=>{
 const evidence={baseSha:'b'.repeat(40),source:{'app.js':'x'.repeat(130000)},edits:[{path:'app.js',before:'x',after:'y'}],tests:{passed:true}};
 assert.throws(()=>budgetModelEvidence(evidence),/model_evidence_cannot_fit_immutable_context/);
 assert.equal(evidence.source['app.js'].length,130000);
});
