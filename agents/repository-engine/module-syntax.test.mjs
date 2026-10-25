import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkCandidateModuleSyntax as check} from './module-syntax.mjs';
test('actual module parser rejects the live patch-prefix failure with actionable plain-source feedback',()=>{
 assert.throws(()=>check({'worker.mjs':"export function run(){\n+ const originalWork={};\n return originalWork;\n}"}),/plain replacement source.*unified-diff/);
});
test('parse-only preflight does not run top-level code, import dependencies or rewrite source',()=>{
 const source="import unavailable from 'this-module-does-not-exist';\nthrow Error('must not execute');\nconst fixture=`\\n+ const example={};`;\nexport default fixture;";
 const patched={'worker.mjs':source,'utility.cjs':'module.exports=1;'};
 assert.deepEqual(check(patched),{parsedOnly:true,codeExecuted:false});
 assert.equal(patched['worker.mjs'],source);
});
test('valid unary-plus source is preserved; non-module paths retain their existing adapter',()=>{
 assert.doesNotThrow(()=>check({'worker.mjs':'const a=1;\n+ a;\nexport default a;'}));
 assert.doesNotThrow(()=>check({'index.html':'<button>Play</button>','main.js':'uses existing package-mode checker'}));
});
test('real runner parses the exact candidate before review while retaining full tests and arbitration',()=>{
 const s=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
 const start=s.indexOf('const patched=applyEdits(original,proposal.edits);');
 const preflight=s.indexOf('checkCandidateModuleSyntax(patched);',start);
 assert.ok(preflight>start&&preflight<s.indexOf("await event('greenbeans','Engineer produced",start));
 assert.ok(preflight<s.indexOf("await call('engine-review'",start));
 assert.match(s,/await checks\(candidate.patched\)/);assert.match(s,/await call\('arbitrate'/);
});
