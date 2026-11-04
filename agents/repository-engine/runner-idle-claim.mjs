/* A no-lease result is not a completed build. Display only typed, bounded,
 * server-calculated diagnostics from the signed owner partition. */
const CODES=new Set(['owner_queue_empty','admission_deferred','no_matching_runner_adapter','eligible_but_not_claimed']);
const SKIPS=['source_repair_active','dependency_pending','repository_lease_active','commit_verification_required','runner_backoff','recent_runner_receipt','owner_decision_required','claimed_by_runner','d1_update_conflict','other_policy'];
export function parseRunnerIdle(claim){
 if(claim?.lease)return null;
 const value=claim?.idle;
 if(!CODES.has(value?.code))return {code:'reason_unavailable'};
 const n=x=>Number.isSafeInteger(x)&&x>=0&&x<=500?x:0;
 return {code:value.code,examined:n(value.examined),admitted:n(value.admitted),
  deferred:n(value.deferred),adapterMatches:n(value.adapterMatches),agedOut:n(value.agedOut),
  scanLimited:value.scanLimited===true,
  ...(value.claimBlockedBy&&typeof value.claimBlockedBy==='object'&&!Array.isArray(value.claimBlockedBy)?{
   claimBlockedBy:Object.fromEntries(SKIPS.filter(k=>Object.hasOwn(value.claimBlockedBy,k)).map(k=>[k,n(value.claimBlockedBy[k])]))
  }:{})};
}
