import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNotes,filesForResearch} from './bubbles-organic-computation.mjs';
test('only scientific informational prose is accepted',()=>{
 assert.throws(()=>validateNotes('short'),/length/);
 assert.throws(()=>validateNotes('Example '.repeat(25)+'<script>alert(1)</script>'),/unsafe/);
 assert.ok(validateNotes('DARPA O-Circuit explores energy-efficient neural tissue computing. '.repeat(3)).length>100);
});
test('creates a software-only reproducible research package',()=>{
 const files=filesForResearch('Independent observations; all claims must be checked. '.repeat(4));
 for(const path of ['README.md','research/overview.md','research/hypotheses.md','research/bubbles-analysis.md','research/sources.json','simulations/associative_memory.py','tests/test_associative_memory.py'])assert.ok(Object.hasOwn(files,path));
 assert.match(files['README.md'],/not a working biological processor/);
 assert.match(files['research/hypotheses.md'],/User hypothesis/);
 assert.match(files['simulations/associative_memory.py'],/def experiment/);
 assert.deepEqual(JSON.parse(files['research/sources.json']).sources.length,3);
});
