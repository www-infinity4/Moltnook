/**
 * Bubbles owner-job routing contract. Pure planning only: it never claims a
 * Brain lease, starts processes, copies credentials, writes source or merges.
 * Callers must authenticate signed jobs and verify completed IDs externally.
 * Clone slots describe pending work for independently leased workers.
 */
const SHA=/^[a-f0-9]{40}$/i;
const ID=/^[a-zA-Z0-9_:-]{1,96}$/;
const REPO=/^www-infinity4\/[A-Za-z0-9_.-]{1,80}$/;
const BAD_PATH=/^(?:\.git|\.env(?:\.|$)|secrets?|credentials?|node_modules)$/i;
const KIND_SCORE={security:40,infrastructure:30,data:20,card:10,other:0};
const PRIORITY_SCORE={critical:400,high:300,normal:200,low:100};
function validPath(value){
 return typeof value==='string'&&value.length>0&&value.length<=180&&
  !value.startsWith('/')&&/^[A-Za-z0-9_.\/-]+$/.test(value)&&
  value.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!BAD_PATH.test(p));
}
function validateJob(job){
 if(!job||typeof job!=='object'||!ID.test(job.id||''))throw new TypeError('invalid job id');
 if(!REPO.test(job.repository||''))throw new TypeError('invalid repository');
 if(!SHA.test(job.baseSha||''))throw new TypeError('invalid baseSha');
 if(typeof job.leaseId!=='string'||!ID.test(job.leaseId))throw new TypeError('invalid leaseId');
 if(!Object.hasOwn(PRIORITY_SCORE,job.priority))throw new TypeError('invalid priority');
 if(!Object.hasOwn(KIND_SCORE,job.kind))throw new TypeError('invalid kind');
 if(!['read','write'].includes(job.access))throw new TypeError('invalid access');
 if(!Array.isArray(job.targetPaths)||job.targetPaths.length>16||job.targetPaths.some(p=>!validPath(p)))throw new TypeError('invalid targetPaths');
 if(!Array.isArray(job.dependencies)||job.dependencies.length>16||job.dependencies.some(d=>!ID.test(d||'')||d===job.id)||new Set(job.dependencies).size!==job.dependencies.length)throw new TypeError('invalid dependencies');
}
function boundedInt(value,name,min,max){
 if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(name+' must be '+min+'..'+max);
 return value;
}
function cycleIds(jobsById,completed){
 const visiting=new Set(),visited=new Set(),cycles=new Set(),stack=[];
 function visit(id){
  if(visited.has(id))return;
  if(visiting.has(id)){
   for(const member of stack.slice(stack.indexOf(id)))cycles.add(member);
   return;
  }
  visiting.add(id);stack.push(id);
  for(const dep of jobsById.get(id).dependencies){if(!completed.has(dep)&&jobsById.has(dep))visit(dep)}
  stack.pop();visiting.delete(id);visited.add(id);
 }
 for(const id of jobsById.keys())visit(id);
 return cycles;
}
// A context packet can be sent to a model; verified provenance does not
// mean source text is free of credentials. Redact known patterns in both
// human notes and pinned source excerpts. Upstream secret-scanning remains
// mandatory; this is defense in depth, not a complete secret detector.
function redactModelEvidence(value){
 return String(value??'')
  .replace(/(authorization\s*[:=]\s*(?:bearer|basic|token)\s+)[^\s"']+/gi,'$1[redacted]')
  .replace(/((?:password|secret|token|api[_-]?key|client[_-]?secret)\s*[:=]\s*)["']?[^\s"',;]+["']?/gi,'$1[redacted]')
  .replace(/(?:github_pat_[A-Za-z0-9_]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,})\b/g,'[redacted]');
}

function conflicts(a,b){
 if(a.repository!==b.repository||a.access==='read'&&b.access==='read')return false;
 // Empty/unspecified write footprints serialize at repository scope.
 if((a.access==='write'&&!a.targetPaths.length)||(b.access==='write'&&!b.targetPaths.length))return true;
 return a.targetPaths.some(p=>b.targetPaths.some(q=>p===q||p.startsWith(q+'/')||q.startsWith(p+'/')));
}
/** Return stable assignments. A plan is not an execution or identity receipt. */
export function planOwnerDispatch(jobs,options={}){
 if(!Array.isArray(jobs)||jobs.length>64)throw new TypeError('jobs must contain at most 64 entries');
 const directCapacity=boundedInt(options.directCapacity??1,'directCapacity',0,16);
 const overflowCapacity=boundedInt(options.overflowCapacity??0,'overflowCapacity',0,16);
 const completedIds=options.completedIds??[];
 if(!Array.isArray(completedIds)||completedIds.length>64||completedIds.some(x=>!ID.test(x||'')))throw new TypeError('invalid completedIds');
 const completed=new Set(completedIds),map=new Map();
 for(const job of jobs){validateJob(job);if(map.has(job.id))throw new TypeError('duplicate job id');map.set(job.id,job)}
 const active=options.active??[];
 if(!Array.isArray(active)||active.length>32)throw new TypeError('invalid active jobs');
 const seen=new Set(map.keys());
 for(const job of active){
  validateJob(job);
  if(!['direct','read-only-overflow'].includes(job.tier)||job.tier==='read-only-overflow'&&job.access!=='read')throw new TypeError('invalid active worker tier');
  if(seen.has(job.id))throw new TypeError('duplicate active job id');
  seen.add(job.id);
 }
 const cycles=cycleIds(map,completed);
 const blocked=[],waiting=[],direct=[],overflow=[];
 const sorted=[...jobs].sort((a,b)=>
  PRIORITY_SCORE[b.priority]+KIND_SCORE[b.kind]-(PRIORITY_SCORE[a.priority]+KIND_SCORE[a.kind])||a.id.localeCompare(b.id));
 const chosen=[...active];
 const availableDirect=Math.max(0,directCapacity-active.filter(x=>x.tier==='direct').length);
 const availableOverflow=Math.max(0,overflowCapacity-active.filter(x=>x.tier==='read-only-overflow').length);
 for(const job of sorted){
  const metadata={id:job.id,repository:job.repository,baseSha:job.baseSha,leaseId:job.leaseId,kind:job.kind,priority:job.priority,access:job.access};
  if(cycles.has(job.id)){blocked.push({...metadata,reason:'dependency_cycle'});continue;}
  if(job.dependencies.some(dep=>!completed.has(dep)&&!map.has(dep))){blocked.push({...metadata,reason:'unknown_dependency'});continue;}
  if(job.dependencies.some(dep=>!completed.has(dep))){waiting.push({...metadata,reason:'dependency_incomplete'});continue;}
  if(chosen.some(other=>conflicts(job,other))){waiting.push({...metadata,reason:'write_path_conflict'});continue;}
  if(direct.length<availableDirect){direct.push({...metadata,tier:'direct',requiresIndependentClaim:false});chosen.push(job);continue;}
  if(options.allowReadOverflow===true&&job.access==='read'&&overflow.length<availableOverflow){
   overflow.push({...metadata,tier:'read-only-overflow',requiresIndependentClaim:true});chosen.push(job);continue;
  }
  waiting.push({...metadata,reason:job.access==='write'&&options.allowReadOverflow===true?'independent_write_lease_required':'capacity_reached'});
 }
 return Object.freeze({direct,overflow,waiting,blocked,workExecuted:false,executionAuthorized:false,mergeAuthorized:false,deployed:false});
}
/** Bounded context packet; source evidence must be verified by its producer. */
export function buildWorkerContext(job,evidence={}){
 validateJob(job);
 const source=Array.isArray(evidence.source)?evidence.source:[];
 const prior=Array.isArray(evidence.prior)?evidence.prior:[];
 const notes=typeof evidence.notes==='string'?redactModelEvidence(evidence.notes.slice(0,1200)):'';
 return Object.freeze({schemaVersion:1,jobId:job.id,repository:job.repository,baseSha:job.baseSha,leaseId:job.leaseId,
  dependencies:[...job.dependencies],targetPaths:[...job.targetPaths],
  source:source.filter(s=>s?.verified===true&&validPath(s.path)&&SHA.test(s.commitSha||'')).slice(0,8).map(s=>({path:s.path,commitSha:s.commitSha,excerpt:redactModelEvidence(String(s.excerpt||'').slice(0,1200))})),
  prior:prior.filter(p=>p?.verified===true&&['source_read','checks_passed','checks_failed','pr_opened','merge_verified','deployment_verified','blocked'].includes(p.event)&&typeof p.url==='string'&&/^https:\/\/github\.com\/www-infinity4\//.test(p.url)).slice(0,12).map(p=>({event:p.event,url:p.url})),
  notes,writeAuthorized:false,mergeAuthorized:false});
}
/** Only a trusted caller may report independently verified external receipts. */
export function checkWorkerResult(job,result,independentlyVerified=false){
 validateJob(job);
 if(!result||result.id!==job.id||result.leaseId!==job.leaseId||result.baseSha!==job.baseSha)return {status:'rejected',reason:'claim_mismatch'};
 if(independentlyVerified!==true)return {status:'unverified',reason:'independent_receipt_missing'};
 if(result.status!=='tested'||!SHA.test(result.commitSha||''))return {status:'rejected',reason:'source_check_receipt_missing'};
 return {status:'verified_source_result',jobId:job.id,commitSha:result.commitSha,mergeVerified:false,deploymentVerified:false};
}
