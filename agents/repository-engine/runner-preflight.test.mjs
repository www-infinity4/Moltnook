import test from 'node:test';
import assert from 'node:assert/strict';
import {readOptionalRootReadme,trackRunnerRequest} from './runner-preflight.mjs';
test('optional README skips only the typed symlink refusal',async()=>{
 const report={}; const refusal=Object.assign(new Error('Writer refuses symlink source'),{code:'writer_symlink_source'});
 assert.equal(await readOptionalRootReadme(async p=>{assert.equal(p,'README.md');throw refusal},report),null);
 assert.deepEqual(report.rootReadme,{path:'README.md',state:'skipped_symlink'});
});
test('regular and missing README are distinguished; unrelated errors propagate',async()=>{
 const report={}; assert.equal(await readOptionalRootReadme(async()=> 'readme',report),'readme');assert.equal(report.rootReadme.state,'read');
 assert.equal(await readOptionalRootReadme(async()=>null,report),null);assert.equal(report.rootReadme.state,'missing');
 const e=new Error('permission denied');await assert.rejects(readOptionalRootReadme(async()=>{throw e},report),err=>err===e);
});
test('claim failure records operation, phase, HTTP status without payload or retry',async()=>{
 const report={};const e=new Error('private response body');let attempts=0;
 await assert.rejects(trackRunnerRequest(report,'claim',async trace=>{attempts++;trace.phase='response';trace.httpStatus=503;throw e}),err=>err===e);
 assert.equal(attempts,1);assert.deepEqual(report.runnerRequestFailures,[{operation:'claim',phase:'response',httpStatus:503}]);
 assert.doesNotMatch(JSON.stringify(report),/private response body/);
});
test('identity and transport failures do not invent HTTP status; successes leave no failure',async()=>{
 const report={};const e=new Error('unavailable');
 await assert.rejects(trackRunnerRequest(report,'capability',async()=>{throw e}));
 await assert.rejects(trackRunnerRequest(report,'claim',async trace=>{trace.phase='transport';throw e}));
 assert.equal(await trackRunnerRequest(report,'capability',async()=>42),42);
 assert.deepEqual(report.runnerRequestFailures,[{operation:'capability',phase:'identity',httpStatus:null},{operation:'claim',phase:'transport',httpStatus:null}]);
});
test('failure history is bounded and unknown operation text is not copied',async()=>{
 const report={};for(let i=0;i<40;i++)await assert.rejects(trackRunnerRequest(report,'private operation value',async()=>{throw Error('secret')}));
 assert.equal(report.runnerRequestFailures.length,32);assert.ok(report.runnerRequestFailures.every(x=>x.operation==='other'));
});
