import test from 'node:test';
import assert from 'node:assert/strict';
import {cardTarget,focusIssue,chooseFocus,FOCUS_MARKER,CARD_TARGETS} from './oracle-focus-policy.mjs';
const finding=(name)=>({name:'www-infinity4/'+name,sha:'a'.repeat(40),concerns:['No Oracle Octaves contract identified'],uiPaths:['index.html']});
test('only registered live card repositories are scheduled; forked libraries do not qualify',()=>{
 assert.equal(cardTarget('www-infinity4/playwright'),null);
 assert.equal(cardTarget('www-infinity4/qdrant'),null);
 assert.equal(cardTarget('other/Bitcoin-Crusher'),null);
 assert.equal(cardTarget('www-infinity4/Bitcoin-Crusher').card,'bitcoin-crusher');
 assert.ok(CARD_TARGETS.every(x=>x.route.startsWith('/')));
 assert.equal(focusIssue(finding('playwright')),null);
});
test('serial focus selects Bitcoin Crusher first, source grounded and never asserts a deploy',()=>{
 const pick=chooseFocus([finding('QuantaPhi'),finding('Bitcoin-Crusher')],[]);
 assert.equal(pick.status,'ready');
 assert.match(pick.proposal.title,/Bitcoin-Crusher/);
 assert.match(pick.proposal.body,/obsolete Copilot-like game environment/);
 assert.match(pick.proposal.body,/DRAFT PR/);
 assert.match(pick.proposal.body,/Owner approval required/);
 assert.ok(pick.proposal.body.includes(FOCUS_MARKER));
});
test('an open focused issue blocks additional new proposals',()=>{
 const prior=focusIssue(finding('Bitcoin-Crusher'));
 const open={...prior,state:'open',html_url:'https://github.com/www-infinity4/Oracle-Octaves/issues/999'};
 const result=chooseFocus([finding('Bitcoin-Crusher'),finding('Omni-Phi')],[open]);
 assert.equal(result.status,'awaiting_existing_focus');assert.equal(result.proposal,null);
 assert.match(result.activeUrl,/999/);
});
test('closing a focused issue moves to next card and never duplicates completed proposals',()=>{
 const prior=focusIssue(finding('Bitcoin-Crusher'));
 const result=chooseFocus([finding('Bitcoin-Crusher'),finding('Alien-Radio')],[{...prior,state:'closed'}]);
 assert.equal(result.status,'ready');assert.match(result.proposal.title,/Alien-Radio/);
 assert.equal(chooseFocus([finding('Bitcoin-Crusher')],[{...prior,state:'closed'}]).status,'no_unreviewed_registered_card');
});
test('no hallucinated source or approval for invalid audit input',()=>{
 assert.equal(focusIssue({name:'www-infinity4/Bitcoin-Crusher',concerns:[],uiPaths:['index.html']}),null);
 assert.equal(focusIssue({name:'www-infinity4/Bitcoin-Crusher',concerns:['missing'],uiPaths:[]}),null);
 assert.throws(()=>chooseFocus([],null),/Complete owner inventory/);
});
