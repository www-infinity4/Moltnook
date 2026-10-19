import test from 'node:test';
import assert from 'node:assert/strict';
import {lintPython} from './python-language.mjs';
test('pinned lint is bounded, isolated from target configuration and credential-free',()=>{
 const calls=[];
 const result=lintPython(['src/a.py'],{execute:(cmd,args,options)=>{calls.push({cmd,args,options});return args[0]==='--version'?'ruff 0.17.1':'[]';}});
 assert.equal(result.passed,true);assert.equal(result.sourceExecuted,false);
 assert.ok(calls[1].args.includes('--isolated'));assert.ok(calls[1].args.includes('--'));
 assert.equal(calls[1].options.timeout,90000);
 assert.deepEqual(Object.keys(calls[1].options.env).sort(),['CI','HOME','LANG','PATH']);
});
test('invalid paths, missing runtime, diagnostics and wrong version do not pass',()=>{
 for(const file of ['../escape.py','/tmp/escape.py','a/../b.py','a.py\nother.py'])assert.throws(()=>lintPython([file]),/paths_required/);
 assert.throws(()=>lintPython(['a.py'],{execute:()=>{throw Error('missing')}}),/missing/);
 assert.throws(()=>lintPython(['a.py'],{execute:()=> 'ruff 9.0'}),/pinned_ruff/);
 assert.throws(()=>lintPython(['a.py'],{execute:(_,args)=>args[0]==='--version'?'ruff 0.17.1':'[{"code":"F821"}]'}),/diagnostics/);
});
