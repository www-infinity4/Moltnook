// Never write bot patches straight to main. A source review and local tests
// are prerequisites for staging, not proof of production acceptance.
export async function publishReviewed({repository,base,commitSha,jobId,runId,push,api}){
 if(!/^www-infinity4\/[\w.-]+$/.test(repository)||!/^[a-f0-9]{40}$/.test(commitSha)||!/^\d+$/.test(String(runId))||typeof jobId!=='string'||!jobId)throw Error('invalid_reviewed_publish');
 const branch='robot/'+String(jobId).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,90)+'/'+runId;
 await push('HEAD:refs/heads/'+branch);
 const pr=await api('repos/'+repository+'/pulls',{method:'POST',body:{
  title:'Robot review: '+jobId,
  base,head:branch,draft:false,
  body:'Implements the owner-authorized job '+jobId+'.\n\n'+
   'Staging evidence: pinned base, independent Pink review, repository tests and GPT Purple arbitration are recorded in the originating Moltnook Actions artifact.\n'+
   'These are pre-PR checks, not a substitute for target-repository CI or production acceptance.\n\n'+
   'Merge only after required target checks pass, the commit SHA and reviewer evidence match, and no branch rule is bypassed.\n\n'+
   'Staged source commit: '+commitSha
 }});
 if(!pr?.html_url||pr.head?.sha!==commitSha||pr.base?.ref&&pr.base.ref!==base)throw Error('reviewed_pr_receipt_mismatch');
 return {status:'committed_unverified',reviewState:'awaiting_target_ci_and_merge_review',
  commitSha,publishedToDefault:false,prUrl:pr.html_url,prNumber:pr.number,branch};
}
