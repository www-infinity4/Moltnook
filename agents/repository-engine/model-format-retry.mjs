// Retry only recoverable model-response formatting faults. Authentication, scope,
// missing credentials and denied operations must never be silently retried.
const FORMAT=/Expected (?:double-quoted property name|property name|','|':'|value)|(?:Unexpected|Unterminated|Bad (?:control|escaped) character|JSON parse|model_json_invalid|engine_json_invalid).*?(?:JSON|token|string|position)|(?:JSON|object).*(?:parse|syntax|format)/i;
export async function retryStructuredModelCall(fn,{attempts=3,onRetry}={}){
 if(typeof fn!=='function'||!Number.isInteger(attempts)||attempts<1||attempts>3)throw Error('retry_contract_invalid');
 for(let i=0;i<attempts;i++){
  try{return await fn(i)}catch(error){
   const message=String(error?.message||error);
   if(i===attempts-1||!FORMAT.test(message))throw error;
   if(typeof onRetry==='function')await onRetry({attempt:i+1,reason:'Malformed model JSON, requesting a new structured response'});
  }
 }
}
