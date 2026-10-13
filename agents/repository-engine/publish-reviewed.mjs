export async function publishReviewed({repository,base,commitSha,jobId,runId,push,api}){
 if(!/^www-infinity4\/[\w.-]+$/.test(repository)||!/^[a-f0-9]{40}$/.test(commitSha)||!/^\d+$/.test(String(runId)))throw Error('invalid_reviewed_publish');
 try{await push('HEAD:'+base);return {status:'committed_unverified',commitSha,publishedToDefault:true};}
 catch(error){if(!/protected branch|GH006|GH013|Changes must be made through a pull request|repository rule violations/i.test(String(error.stderr||error.message)))throw error;}
 const branch='robot/'+jobId.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,90)+'/'+runId;
 await push('HEAD:refs/heads/'+branch);
 const pr=await api('repos/'+repository+'/pulls',{method:'POST',body:{title:'Robot repair: '+jobId,base,head:branch,body:'Implements the owner-approved job '+jobId+'. The authenticated runner recorded pinned source, independent review, passing tests and GPT Purple approval before this commit.\n\nDefault branch protection requires this pull request. Deployment and live feature acceptance are not yet verified.\n\nSource commit: '+commitSha}});
 if(!pr?.html_url||pr.head?.sha!==commitSha)throw Error('reviewed_pr_receipt_mismatch');
 return {status:'committed_unverified',commitSha,publishedToDefault:false,prUrl:pr.html_url,prNumber:pr.number,branch};
}
