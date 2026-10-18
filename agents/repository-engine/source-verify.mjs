/*
 * Independent read-only Pink source verification, not a Green code patch.
 * All repository operations are pinned to the authenticated checkout;
 * the server separately verifies the PR merge, current head and owner ticket.
 */
const SHA=/^[0-9a-f]{40}$/;
const REPO=/^www-infinity4\/[A-Za-z0-9_.-]+$/;
const TEST=/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:test|spec)\.(?:js|mjs|cjs)$/;
export function sourceReviewEligibility({job,sourceReview,capability}={}){
 if(capability?.sourceReviewV1!==true||sourceReview?.kind!=='source_review_only'||
  sourceReview?.mayWrite!==false||job?.agent!=='pink-panther'||
  !REPO.test(job?.repository||'')||job.repository!==sourceReview.repository||
  !SHA.test(sourceReview.mergeSha||'')||
  !Number.isSafeInteger(sourceReview.prNumber)||sourceReview.prNumber<1)
  return {eligible:false,reason:'verified_source_review_adapter_unavailable'};
 return {eligible:true,review:sourceReview};
}
export function verifiedSourceReviewPlan({job,sourceReview,capability,pr,changedPaths,headSha}){
 const gate=sourceReviewEligibility({job,sourceReview,capability});
 if(!gate.eligible)throw Error(gate.reason);
 if(!pr||pr.merged!==true||pr.merge_commit_sha!==sourceReview.mergeSha||
  pr.head?.sha!==sourceReview.sourceCommitSha||
  pr.base?.ref!=='main'||pr.base?.repo?.full_name!==sourceReview.repository||
  !String(pr.title||'').includes(sourceReview.primaryId)||
  !SHA.test(headSha||'')||!Array.isArray(changedPaths)||changedPaths.length>=100)
  throw Error('merged_source_review_provenance_invalid');
 const allowed=changedPaths.filter(path=>typeof path==='string'&&TEST.test(path)).slice(0,8);
 if(!allowed.length)throw Error('merged_source_review_test_paths_missing');
 const sourcePaths=changedPaths.filter(path=>typeof path==='string'&&!TEST.test(path));
 if(!sourcePaths.length)throw Error('merged_source_review_source_paths_missing');
 return {repository:job.repository,sourceSha:headSha,mergeSha:sourceReview.mergeSha,
  prNumber:sourceReview.prNumber,testPaths:allowed,sourcePaths,
  productionVerified:false,newCommit:false,sourceReviewOnly:true};
}
export async function runSourceReview({job,sourceReview,capability,headSha,github,readSource,runCommand}){
 const gate=sourceReviewEligibility({job,sourceReview,capability});
 if(!gate.eligible)throw Error(gate.reason);
 const repo=sourceReview.repository,num=sourceReview.prNumber;
 const [pr,changed]=await Promise.all([
  github('repos/'+repo+'/pulls/'+num),
  github('repos/'+repo+'/pulls/'+num+'/files?per_page=100')
 ]);
 const plan=verifiedSourceReviewPlan({job,sourceReview,capability,pr,
  changedPaths:Array.isArray(changed)?changed.map(x=>x.filename):null,headSha});
 await runCommand('git',['merge-base','--is-ancestor',plan.mergeSha,'HEAD']);
 const runs=[];
 for(const path of plan.testPaths){
  const content=await readSource(path);
  if(typeof content!=='string'||content.length<1)throw Error('merged_test_source_missing: '+path);
  const output=await runCommand('node',['--test',path]);
  runs.push({name:'Node test: '+path,passed:true,output:String(output||'').slice(-1200)});
 }
 if(runs.length<1)throw Error('merged_source_tests_not_executed');
 return {status:'source_verified',testsPassed:true,reviewedMergeSha:plan.mergeSha,
  commitSha:plan.sourceSha,testPaths:plan.testPaths,productionVerified:false,
  ownerApprovalGranted:false,mergedNewCode:false,tests:{passed:true,runs},
  prUrl:sourceReview.prUrl,noNewSourceWrites:true,noRewards:true};
}
