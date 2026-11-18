/** Bounded read-only Blue/Yellow dispatch; never grants a writer lease. */
export async function dispatchReadJobs(jobs,handlers,options={}){
 if(!Array.isArray(jobs)||jobs.length>64)throw new TypeError('jobs must be an array of at most 64');
 const concurrency=options.concurrency??4;
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>16)throw new RangeError('concurrency must be 1..16');
 const ids=new Set();
 for(const job of jobs){
  if(!job||!['blue','yellow'].includes(job.role)||typeof job.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(job.id)||ids.has(job.id))throw new TypeError('invalid or duplicate read job');
  ids.add(job.id);
 }
 const results=new Array(jobs.length);let next=0;
 async function worker(){
  while(next<jobs.length){
   const index=next++,job=jobs[index],handler=handlers?.[job.role];
   if(typeof handler!=='function'){results[index]={id:job.id,role:job.role,status:'blocked',error:'handler_unavailable'};continue;}
   try{
    const receipt=await handler(Object.freeze({...job}));
    results[index]=receipt?.verified===true&&typeof receipt.source==='string'&&receipt.source.trim()?
      {id:job.id,role:job.role,status:'verified',receipt}:
      {id:job.id,role:job.role,status:'unverified',error:'source_receipt_missing'};
   }catch(error){results[index]={id:job.id,role:job.role,status:'failed',error:String(error?.message||error).slice(0,180)};}
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},()=>worker()));
 return Object.freeze({results,verified:results.filter(x=>x.status==='verified').length,writeAuthorized:false,mergeAuthorized:false,deployed:false});
}