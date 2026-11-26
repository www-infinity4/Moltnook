// Optional discovery metadata must not weaken strict source or writer policy.
export async function readOptionalRootReadme(read,report){
 try{
  const text=await read('README.md');
  report.rootReadme={path:'README.md',state:text===null?'missing':'read'};
  return text;
 }catch(error){
  if(error?.code!=='writer_symlink_source')throw error;
  report.rootReadme={path:'README.md',state:'skipped_symlink'};
  return null;
 }
}
const OPERATIONS=new Set(['quant-audit','capability','claim','event','plan','build','review','arbitrate','result','source-review-receipt','quant-receipt','preview','color','archive-screenshot']);
const PHASES=new Set(['identity','transport','response']);
// Record only fixed operation metadata. Never copy a response, credential, or lease.
export async function trackRunnerRequest(report,operation,execute){
 const trace={phase:'identity',httpStatus:null};
 try{return await execute(trace)}catch(error){
  const receipt={operation:OPERATIONS.has(operation)?operation:'other',
   phase:PHASES.has(trace.phase)?trace.phase:'unknown',
   httpStatus:Number.isInteger(trace.httpStatus)&&trace.httpStatus>=100&&trace.httpStatus<=599?trace.httpStatus:null};
  report.runnerRequestFailures=[...(report.runnerRequestFailures||[]),receipt].slice(-32);
  throw error;
 }
}
export async function parseRunnerResponse(r){
 if(r.status===429)throw Error('brain_runner_rate_limited_http_429');
 let result;
 try{result=await r.json();}catch{throw Error('brain_runner_invalid_json_http_'+r.status);}
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('brain_runner_invalid_json_http_'+r.status);
 if(!r.ok||result.ok!==true)throw Error(typeof result.error==='string'&&result.error?result.error:'Robot brain HTTP '+r.status);
 return result;
}
