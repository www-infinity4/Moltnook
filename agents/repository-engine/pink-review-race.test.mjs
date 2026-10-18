import test from 'node:test';
import assert from 'node:assert/strict';
import {isDeferredPinkReviewRace} from './pink-review-race.mjs';
const lease={job:{sourceReview:{kind:'source_review_only'}}};
const error=new Error('source_review_repair_still_executing_or_finished');
test('signed Pink review race is a defer, not a failed build or false approval',()=>{
 assert.equal(isDeferredPinkReviewRace({lease,error,commitSha:''}),true);
 assert.equal(isDeferredPinkReviewRace({lease,error,commitSha:'a'.repeat(40)}),false);
 assert.equal(isDeferredPinkReviewRace({lease:{job:{}},error,commitSha:''}),false);
 assert.equal(isDeferredPinkReviewRace({lease:null,error,commitSha:''}),false);
 assert.equal(isDeferredPinkReviewRace({lease,error:new Error('source_review_dependency_changed'),commitSha:''}),false);
 assert.equal(isDeferredPinkReviewRace({lease,error:new Error('source_review_github_read_failed_403'),commitSha:''}),false);
 assert.equal(isDeferredPinkReviewRace({lease:{job:{sourceReview:{kind:'normal'}}},error,commitSha:''}),false);
});
