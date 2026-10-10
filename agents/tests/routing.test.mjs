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
