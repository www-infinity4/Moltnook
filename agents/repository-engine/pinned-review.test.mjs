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
 assert.match(source,/call\('engine-review',\{evidence:\{baseSha,plan,edits:candidate\.proposal\.edits,source:original,pinnedControls\}\}\)/);
});
