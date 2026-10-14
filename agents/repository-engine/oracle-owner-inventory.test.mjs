import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRepositoryTree,ticketFromFinding,ORACLE} from './oracle-owner-inventory.mjs';
const repo={full_name:'www-infinity4/Example',headSha:'a'.repeat(40),archived:false};
test('only actual frontend repositories produce design/development ideas',()=>{
 const tree=[{type:'blob',path:'index.html'},{type:'blob',path:'styles.css'}];
 const finding=reviewRepositoryTree(repo,tree,{'index.html':'<h1>Example</h1>','styles.css':'body { background:#111; color: white; }'});
 assert.ok(finding);assert.equal(finding.darkLegacy,true);assert.equal(finding.hasTests,false);assert.equal(finding.hasCI,false);
 const issue=ticketFromFinding(finding);assert.match(issue.body,/44px/);assert.match(issue.body,/Oracle Octaves/);assert.ok(issue.title.includes('Example'));
 assert.equal(reviewRepositoryTree(repo,[{type:'blob',path:'index.py'}],{}),null);
});
test('existing real Oracle styling plus CI and tests passes inventory',()=>{
 const tree=[{type:'blob',path:'index.html'},{type:'blob',path:'oracle-interface.css'},{type:'blob',path:'test/ui.test.js'},{type:'blob',path:'.github/workflows/ui.yml'}];
 assert.equal(reviewRepositoryTree(repo,tree,{'oracle-interface.css':'--oracle-paper: #f7f4f0; .oracle-card{background:white}'}),null);
 assert.equal(ORACLE.surface,'#fff');
});
