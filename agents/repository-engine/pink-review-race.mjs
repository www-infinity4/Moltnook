/** A signed Pink source-only review can lose a race to an associated Green repair.
 * This decision changes only local runner reporting; it never grants approval.
 */
export function isDeferredPinkReviewRace({lease,error,commitSha}){
 return !commitSha&&lease?.job?.sourceReview?.kind==='source_review_only'&&
  error?.message==='source_review_repair_still_executing_or_finished';
}
