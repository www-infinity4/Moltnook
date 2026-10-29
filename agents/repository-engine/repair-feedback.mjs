import {safePath} from './patch.mjs';

// Carry only the runner's own typed immutable-edit facts into the next
// attempt. Do not trust arbitrary error properties as file paths or text.
function safeImmutableDiagnostic(error){
 if(error?.code!=='immutable_edit_match_count')return null;
 try{safePath(error.sourcePath)}catch{return null}
 // Defense in depth: the diagnostic must stay safe even if the separate
 // repository-writer path-policy fix has not merged yet.
 if(error.sourcePath.split('/').some(part=>
  /^(?:\.git|\.env(?:\..*)?|\.envrc|\.npmrc|\.netrc|\.pypirc|\.ssh|\.aws)$/i.test(part)))return null;
 if(!Number.isSafeInteger(error.matchCount)||error.matchCount<0)return null;
 return {code:'immutable_edit_match_count',sourcePath:error.sourcePath,matchCount:error.matchCount};
}

export async function repairWithFeedback({build,review,test,arbitrate,restore,onFeedback,maxAttempts=3,initialFeedback}){
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw Error('Repair attempts must be bounded to 1–3');
 let feedback=initialFeedback;
 // Snapshot the terminal stage/reason before an observer callback can mutate
 // feedback; diagnostic fields are separately revalidated at the boundary.
 let terminalFailure=null;
 const failures=Array.isArray(initialFeedback?.failures)?initialFeedback.failures.slice(-2):[];
 if(initialFeedback?.reason&&!failures.length)failures.push({stage:initialFeedback.stage,reason:String(initialFeedback.reason).slice(0,2000)});
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
   const diagnostic=safeImmutableDiagnostic(error);
   // Never echo arbitrary upstream error.message for typed immutable failures:
   // it could include source text, tokens, or an unsafe file path.
   const reason=error?.code==='immutable_edit_match_count'
    ?'Immutable source edit did not match exactly once'
    :String(error?.message||'Unknown repair error').slice(0,2000);
   failures.push({attempt,stage,reason,...(diagnostic?{diagnostic}:{})});
   feedback={attempt,stage,reason,...(diagnostic?{diagnostic}:{}),
    failures:failures.slice(-3).map(f=>({...f})),...(testResults?{testResults}:{})};
   terminalFailure={stage,reason};
   // The callback is an observer, not the next attempt's authority. Deep-copy
   // nested failure diagnostics before invoking it so mutation cannot alter
   // the next build's immutable source path, reason or retry history.
   await onFeedback(structuredClone(feedback));
  }
 }
 // The final runner failure must retain the same safe path/count that the
 // retry feedback carried. Otherwise the job receipt becomes generic again.
 // Do not re-emit an untrusted upstream error message or source snippet.
 // Callbacks may retain/mutate feedback; revalidate at the receipt boundary.
 const finalDiagnostic=safeImmutableDiagnostic(feedback?.diagnostic);
 const suffix=finalDiagnostic
  ?' (path='+JSON.stringify(finalDiagnostic.sourcePath)+', matches='+finalDiagnostic.matchCount+')'
  :'';
 const exhausted=new Error('Repair attempts exhausted: '+terminalFailure.stage+': '+terminalFailure.reason+suffix);
 if(finalDiagnostic){
  exhausted.code=finalDiagnostic.code;
  exhausted.sourcePath=finalDiagnostic.sourcePath;
  exhausted.matchCount=finalDiagnostic.matchCount;
 }
 throw exhausted;
}
