import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
test('reviewer receives bounded pinned controls from actual source observations',()=>{
 assert.match(source,/report\.featureManifest\?\.checks/);
 assert.match(source,/\.slice\(0,12\)\.map\(check/);
 assert.match(source,/existingLabel:check\.currentLabel/);
 assert.match(source,/existingHref:check\.sourceHref/);
 assert.match(source,/sourceEvidence:true,ownerSpecified:false/);
 assert.ok(source.includes("call('engine-review',{evidence:{baseSha,plan:compactPlan,edits:candidate.proposal.edits,source:windowEvidence.source,phiSkills:phaseSkills('review'),pinnedControls}})"), 'Pink receives immutable windows plus pinned controls');
 assert.ok(source.indexOf('const pinnedControls')<source.indexOf('const repaired'), 'Pinned source facts must be prepared before independent review');
 assert.ok(source.includes("patchedHashes:patchDigests(candidate.patched),source:windowEvidence.source,phiSkills:phaseSkills('arbitrate'),pinnedControls"), 'GPT Purple receives the same pinned windows and exact full-file digests');
 assert.ok(source.includes("checkVisibleEdits(windowEvidence,proposal.edits)"), 'Model edits outside pinned source windows are blocked before apply');
 assert.ok(source.includes("scrub(e.stderr||e.stdout||e.message).slice(0,900)"), 'Actionable Node syntax error must return to engineer');
});
