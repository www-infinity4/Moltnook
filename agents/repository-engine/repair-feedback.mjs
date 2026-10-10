export async function repairWithFeedback({build,review,test,arbitrate,restore,onFeedback,maxAttempts=3}){
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw Error('Repair attempts must be bounded to 1–3');
 let feedback;
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  let stage='build',testResults;
  try{
   const candidate=await build(feedback);
   stage='review';const approval=await review(candidate);
   if(approval.approved!==true)throw Error(approval.reason||'Independent review rejected');
   stage='test';testResults=await test(candidate);
   if(testResults?.passed!==true)throw Error('Required tests did not pass');
   stage='arbitration';const decision=await arbitrate(candidate,approval,testResults);
   if(decision.decision!=='approve')throw Error(decision.reason||'GPT Purple did not approve');
   return {candidate,approval,testResults,decision,attempt};
  }catch(error){
   await restore();
   feedback={attempt,stage,reason:String(error.message),...(testResults?{testResults}:{})};
   await onFeedback(feedback);
  }
 }
 throw Error('Repair attempts exhausted: '+feedback.stage+': '+feedback.reason);
}
