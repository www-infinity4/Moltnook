import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSource} from './bubbles-memory-lab.mjs';
test('memory lab is fixed static source and permits only its own module import',()=>{
 const app="import {rankMemories} from './context-engine.mjs'; document.addEventListener('click',()=>rankMemories([],''));";
 assert.equal(validateSource('app.mjs',app),app);
 for(const source of ["import {x} from 'elsewhere'; addEventListener; rankMemories",app+"fetch('/private')",app+'process.env.GH_TOKEN',app+'document.cookie'])assert.throws(()=>validateSource('app.mjs',source));
 assert.throws(()=>validateSource('../secrets','x'.repeat(100)));
 assert.throws(()=>validateSource('app.mjs','x'.repeat(1501)));
});
