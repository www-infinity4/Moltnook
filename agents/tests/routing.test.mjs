import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECTS,routeEvent,selectRoute} from '../../.github/scripts/agent-routing.mjs';
test('registered project sources are explicit and include the actual fork',()=>{
 assert.ok(PROJECTS.includes('claude-flow'));
 assert.ok(PROJECTS.includes('Oracle-Octaves'));
});
test('physics questions route to Orange Julius',()=>{
 const r=selectRoute('Hydrogen electron physics mechanism','QuantaPhi');
 assert.equal(r.agent,'orange-julius'); assert.match(r.message,/Why is it so/);
});
test('Bitcoin Crusher research remains research-only',()=>{
 const r=selectRoute('Bitcoin Crusher market research','Bitcoin-Crusher');
 assert.equal(r.agent,'naked-gold-digger');assert.equal(r.to,'gold-diggers-ink');
});
test('wallet IDs route to blue decision makers',()=>{
 const r=selectRoute('Unified wallet ledger token IDs','QuantaPhi');
 assert.equal(r.agent,'blueberry');assert.equal(r.to,'bluth');
});
test('bugs route to Pink Panther',()=>{
 assert.equal(selectRoute('Fix a broken image preview','Moltnook').agent,'pink-panther');
});
test('source evidence and closure are not represented as tests',()=>{
 const r=routeEvent({id:'one',project:'Moltnook',title:'Fix UI',kind:'PR',state:'closed',when:'2026-10-09T12:00:00Z',url:'https://github.com/example'});
 assert.equal(r.phase,'Observed closed');assert.match(r.message,/not inferred/);
});

test('a bug in Bitcoin Crusher goes to the debugger, not the market researcher',()=>{
 const r=selectRoute('Bitcoin Crusher broken preview bug','Bitcoin-Crusher');
 assert.equal(r.agent,'pink-panther');
});
test('a research-based StarCoin receipt goes to the ledger desk',()=>{
 const r=selectRoute('Catalog completed research actions with StarCoin receipts','QuantaPhi');
 assert.equal(r.agent,'blueberry');
});
test('outside data import goes Bluey to Blueberry',()=>{
 const r=selectRoute('Import a new structured dataset','Moltnook');
 assert.equal(r.agent,'bluey'); assert.equal(r.to,'blueberry');
});
test('Oracle interface tune goes to Purple Pearl',()=>{
 const r=selectRoute('Oracle Octaves agent floor interface','Moltnook');
 assert.equal(r.agent,'purple-pearl');
});
