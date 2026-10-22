import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument,validateSource} from './bubbles-site-acceptance.mjs';
test('documents are content, never executable tool proposals or paths',()=>{
 assert.equal(parseDocument('```json\n{"content":"Hello"}\n```'),'Hello');
 for(const text of ['{"tool":"shell","content":"x"}','{"content":7}','not JSON'])assert.throws(()=>parseDocument(text));
 assert.throws(()=>validateSource('../README.md','a'.repeat(80)));
 assert.throws(()=>validateSource('app.js',"fetch('https://example.com'); addEventListener('click',()=>{}); // Build check passed."));
 assert.throws(()=>validateSource('app.js','process.env.GH_TOKEN; addEventListener; // Build check passed.'));
});
test('only complete local static sources pass, and unrelated file types are rejected',()=>{
 const html='<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Bubbles Agent Workshop</title><link rel="stylesheet" href="styles.css"><button id="check">Run build check</button><p id="status">Ready</p><script src="app.js" defer></script></html>';
 assert.equal(validateSource('index.html',html),html);
 assert.throws(()=>validateSource('index.html',html.replace('app.js','missing.js')));
 assert.throws(()=>validateSource('styles.css','body{background:white;color:black}'));
 assert.throws(()=>validateSource('.github/workflows/run.yml','x'.repeat(90)));
 assert.throws(()=>validateSource('README.md','x'.repeat(1301)));
});
