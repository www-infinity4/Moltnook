import test from 'node:test';
import assert from 'node:assert/strict';
import {safePath,applyEdits,inside} from './patch.mjs';
test('source edits cannot traverse paths or mutate credentials ',()=>{
 for(const p of ['../file','/tmp/x','a/../../x','.git/config','.env','config/secrets.json','a\\b'])assert.throws(()=>safePath(p));
 assert.equal(safePath('.github/workflows/run.yml'),'.github/workflows/run.yml');
 assert.equal(inside('/tmp/repo','src/page.js'),'/tmp/repo/src/page.js');
});
test('engine binds edits to unique source and explicit new files',()=>{
 assert.deepEqual(applyEdits({'src/a.js':'const value=1;','src/new.js':null},[{path:'src/a.js',before:'value=1',after:'value=2'},{path:'src/new.js',before:null,after:'export default 2;'}]),{'src/a.js':'const value=2;','src/new.js':'export default 2;'});
 assert.throws(()=>applyEdits({'a.js':'same same'},[{path:'a.js',before:'same',after:'other'}]));
 assert.throws(()=>applyEdits({'a.js':'exists'},[{path:'a.js',before:null,after:'replacement'}]));
 assert.throws(()=>applyEdits({'a.js':'unchanged'},[{path:'a.js',before:'unchanged',after:'unchanged'}]));
 assert.throws(()=>applyEdits({'a.js':'old'},[{path:'a.js',before:'missing',after:'new'}]));
});

