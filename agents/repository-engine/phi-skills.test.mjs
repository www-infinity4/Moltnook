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

test('Bubbles routes historical Mongoose carts, existing forks and ESP32 without invented authority',()=>{
 const legacy=skillPackets({task:'Find our mongoose.os c13b0 cardci cart Python scripts and reuse the forks',phase:'plan'});
 for(const id of ['mongoose-c13b0-cart-recovery','verified-fork-navigation'])assert.ok(legacy.some(s=>s.id===id),id);
 const hardware=skillPackets({task:'Use ESP32 Mongoose OS for MQTT telemetry, but first verify the board',phase:'build'});
 assert.ok(hardware.some(s=>s.id==='esp32-firmware-telemetry-boundary'));
 assert.ok(skillPackets({task:'Review the Mongoose cart Python importer',phase:'review'}).some(s=>s.id==='mongoose-c13b0-cart-recovery'));
 assert.ok(skillPackets({task:'Seal the ESP32 repo source and test receipts',phase:'arbitrate'}).some(s=>s.id==='black-evidence-seal'));
 const docs=legacy.find(s=>s.id==='mongoose-c13b0-cart-recovery');
 assert.match(docs.instructions,/NEVER execute untrusted source/);
 assert.match(docs.instructions,/not accessible under current GitHub permissions/);
});

test('conversational webpage publish work activates the org publishing instructions',()=>{
 const selected=skillPackets({task:'Build a webpage and publish it on quantaphi.org',phase:'build'});
 const skill=selected.find(s=>s.id==='quantaphi-org-static-publish');
 assert.ok(skill);
 assert.match(skill.instructions,/actual browser interaction/);
 assert.match(skill.instructions,/authorized executor/);
});

test('broad owner requests retain late matching memory and evidence instructions',()=>{
 const task='Bubbles build Linux GitHub website HTML CSS media radio player card shop merchant wallet paid reward repair memory conversation semantic mongoose c13b0 ESP32 MQTT scripts forks Oracle grade test';
 const selected=skillPackets({task,phase:'plan'});
 assert.ok(selected.length>12,'exercise the old cutoff');
 for(const id of ['private-memory-sector-retrieval','oracle-graded-microchange','black-evidence-seal','starquest-settlement-boundary','esp32-firmware-telemetry-boundary'])assert.ok(selected.some(s=>s.id===id),id);
 assert.equal(new Set(selected.map(s=>s.id)).size,selected.length);
 for(const phase of Object.keys(PHASE_COLORS)){
  const packets=skillPackets({task,phase});
  assert.ok(packets.length<=SKILLS.length);
  assert.ok(packets.every(p=>p.colors.length&&p.colors.every(c=>PHASE_COLORS[phase].includes(c))));
 }
});

test('NVIDIA product work reaches all executor phases through the existing local reference',()=>{
 for(const task of ['NVIDIA skills for Bubbles','CUDA-Q simulation','Jetson JetPack setup','Nemotron voice agent','NIM inference endpoint','TAO workflow stage cards']){
  for(const phase of Object.keys(PHASE_COLORS)){
   const selected=skillPackets({task,phase});
   const nvidia=selected.find(s=>s.id==='nvidia-skill-discovery');
   assert.ok(nvidia,task+' / '+phase);
   assert.equal(nvidia.source,'www-infinity4/Moltnook/agents/repository-engine/nvidia-routing.md');
   assert.ok(nvidia.colors.every(c=>PHASE_COLORS[phase].includes(c)));
   assert.equal('tools' in nvidia,false);
   assert.equal('permissions' in nvidia,false);
  }
 }
});

test('ordinary Infinity jobs do not pick up NVIDIA or TAO setup requirements',()=>{
 for(const task of ['Optimize website search and HTTP request routing','Fix video playback on my radio card','Build an AI chatbot with memory','Tao Te Ching reading card']){
  for(const phase of Object.keys(PHASE_COLORS)){
   assert.ok(!skillPackets({task,phase}).some(s=>s.id.startsWith('nvidia-')),task+' / '+phase);
  }
 }
});

test('TAO stages are conditional guidance rather than a claim of installed services',()=>{
 const stages=skillPackets({task:'NVIDIA TAO workflow with stage cards',phase:'build'}).find(s=>s.id==='nvidia-tao-stage-execution');
 assert.ok(stages);
 assert.match(stages.instructions,/launch gate before running/);
 assert.match(stages.instructions,/not a connected executor/);
 assert.ok(!skillPackets({task:'NVIDIA Jetson camera setup',phase:'build'}).some(s=>s.id==='nvidia-tao-stage-execution'));
 assert.ok(!skillPackets({task:'Reduce chatbot token cost',phase:'plan'}).some(s=>s.id==='nvidia-tao-stage-execution'));
});
