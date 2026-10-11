import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');
test('reuse proposals target enabled QuantaPhi issues and require scoped cross-repo credentials',()=>{
 assert.match(src,/const ISSUE_REPO='www-infinity4\/QuantaPhi'/);
 assert.match(src,/const ISSUE_TOKEN=process\.env\.REUSE_RADAR_TOKEN/);
 assert.match(src,/if\(write&&!auth\)throw Error\('reuse_radar_issue_token_unavailable'\)/);
 assert.ok(src.includes("gh('/repos/'+ISSUE_REPO+'/issues"));
 assert.doesNotMatch(src,/\/repos\/www-infinity4\/Moltnook\/issues/);
});
test('model reviews remain bounded and cannot silently alter code or wallet credits',()=>{
 assert.match(src,/report\.reviewed\.length>=10/);
 assert.match(src,/report\.opened>=3/);
 assert.match(src,/acceptReview\(response,source,item\.sha,feature,options\)/);
 assert.doesNotMatch(src,/bot-work-credit|internal\/tokens\/mint|UPDATE accounts/);
});
