import test from 'node:test';
import assert from 'node:assert/strict';
import {skillPackets,SKILLS,PHASE_COLORS} from './phi-skills.mjs';
test('skill sources correspond to named, existing Phi systems and no tool capability is granted',()=>{
 assert.ok(SKILLS.length>=6);
 for(const x of SKILLS){assert.match(x.source,/^www-infinity4\/(QuantaPhi|WidgetPhi|Moltnook)\//);assert.ok(x.instructions.length>50);
  assert.doesNotMatch(x.instructions,/api[_ -]?key\s*[:=]|authorization:\s*bearer /i);}
});
test('website builders receive executable-runtime guidance and retain the evidence seal',()=>{
 const build=skillPackets({task:'Bubbles build HTML CSS JavaScript website README in GitHub repository using Linux scripts',phase:'build'});
 for(const id of ['linux-job-workspace','github-build-publish','static-site-source','executor-conversation-handoff'])assert.ok(build.some(x=>x.id===id));
 assert.ok(skillPackets({task:'Verify Bubbles website deployment',phase:'arbitrate'}).some(x=>x.id==='black-evidence-seal'));
});
test('private QuantaPhi stock requests provide semantic/WidgetPhi skills to Blue',()=>{
 const list=skillPackets({task:'Use QuantaData semantic links to add a stock card to my personal QuantaPhi workspace',repository:'www-infinity4/WidgetPhi',phase:'plan'});
 assert.ok(list.some(x=>x.id==='quanta-data-semantic-web'));
 assert.ok(list.some(x=>x.id==='widgetphi-card-registry'));
 assert.ok(list.every(x=>x.colors.every(c=>PHASE_COLORS.plan.includes(c))));
});
test('Green receives working card and source instructions, not payment unless relevant',()=>{
 const a=skillPackets({task:'Build a media player card from video source',phase:'build'});
 assert.ok(a.some(x=>x.id==='source-backed-media'));
 assert.ok(a.some(x=>x.id==='widgetphi-card-registry'));
 assert.ok(!a.some(x=>x.id==='starquest-settlement-boundary'));
 const b=skillPackets({task:'Build card with wallet paid unlock',phase:'build'});
 assert.ok(b.some(x=>x.id==='starquest-settlement-boundary'));
});
test('Pink verifies regressions and Purple/Black gate receipts',()=>{
 assert.ok(skillPackets({task:'Fix broken radio player failed embed',phase:'review'}).some(x=>x.id==='media-repair-and-watch'));
 assert.ok(skillPackets({task:'Verify private card deployment',phase:'arbitrate'}).some(x=>x.id==='black-evidence-seal'));
 assert.throws(()=>skillPackets({phase:'billing'}),/Unknown color-agent phase/);
});


test('memory and small Oracle upgrades receive narrow executable skill guidance',()=>{
 const memory=skillPackets({task:'Remember my earlier conversation about my brother and scripts; use repository memory',phase:'plan'});
 assert.ok(memory.some(x=>x.id==='private-memory-sector-retrieval'));
 const ui=skillPackets({task:'Build an Oracle card with working button, then grade the CSS and actual tests',phase:'build'});
 assert.ok(ui.some(x=>x.id==='oracle-graded-microchange'));
 assert.ok(skillPackets({task:'grade Oracle card fix',phase:'review'}).some(x=>x.id==='oracle-graded-microchange'));
});
