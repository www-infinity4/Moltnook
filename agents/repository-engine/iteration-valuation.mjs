/**
 * Non-monetary telemetry for real Moltnook GitHub source inspections.
 * One GitHub Actions run can add at most one entry per checked job/path.
 * No coins, tokens, wallet credits, payouts, or model execution are implied.
 * Git history retains previous snapshots; recent details are bounded here.
 */
const RUN_RE=/^https:\/\/github\.com\/www-infinity4\/Moltnook\/actions\/runs\/([1-9][0-9]*)$/;
const SHA_RE=/^[a-f0-9]{40}$/i;
const MAX_RECENT_TRANSITIONS=100;

const zero=()=>({
 schemaVersion:1,
 unit:'internal_non_monetary_inspection_points',
 last_processed_run_id:null,
 last_run_url:null,
 last_run_at:null,
 total_completed_iterations:0,
 cumulative_system_value:0,
 by_repository:{},
 recent_transitions:[]
});

export function recordIterationValuation(previous, jobs,{runUrl,generatedAt}={}){
 const base=previous?.schemaVersion===1&&previous.unit==='internal_non_monetary_inspection_points'?previous:zero();
 const match=typeof runUrl==='string'?runUrl.match(RUN_RE):null;
 if(!match)return base; // An unreceipted local inspection is not a credited action.
 const runId=match[1];
 if(base.last_processed_run_id!=null&&BigInt(runId)<=BigInt(base.last_processed_run_id))return base;
 const next={...base,by_repository:{...base.by_repository},
  recent_transitions:[...(base.recent_transitions||[])],
  last_processed_run_id:runId,last_run_url:runUrl,last_run_at:generatedAt||null};
 for(const job of Array.isArray(jobs)?jobs:[]){
  if(!job||typeof job.id!=='string'||!Array.isArray(job.checks)||
     typeof job.repo!=='string'||!/^[a-z0-9_.-]{1,100}$/i.test(job.repo))continue;
  const repo=job.repo;
  const aggregate={attempted_iterations:0,failed_iterations:0,
   total_completed_iterations:0,cumulative_system_value:0,
   ...(next.by_repository[repo]||{})};
  job.checks.forEach((check,index)=>{
   if(!check||typeof check.path!=='string')return;
   const verified=check.found===true&&SHA_RE.test(check.sha||'')&&
    SHA_RE.test(job.head?.sha||'')&&
    check.url===`https://github.com/www-infinity4/${repo}/blob/${job.head.sha}/${check.path.split('/').map(encodeURIComponent).join('/')}`;
   const credit=verified?1:0;
   aggregate.attempted_iterations+=1;
   aggregate.failed_iterations+=verified?0:1;
   aggregate.total_completed_iterations+=credit;
   aggregate.cumulative_system_value+=credit;
   next.total_completed_iterations+=credit;
   next.cumulative_system_value+=credit;
   next.recent_transitions.push({
    transition_id:`${runId}:${job.id}:${index}`,
    repository_name:repo,job_id:job.id,
    current_lifecycle_stage:'source_inspection',
    result:verified?'source_verified':'source_unverified',
    source_path:check.path,
    source_commit_sha:SHA_RE.test(job.head?.sha||'')?job.head.sha:null,
    content_sha:verified?check.sha:null,
    source_url:verified?check.url:null,
    run_url:runUrl,observed_at:generatedAt||null,
    iteration_weight_type:verified?'STANDARD':'UNVERIFIED',
    system_credit_value:credit,
    website_scope_identifier:typeof job.websiteScopeIdentifier==='string'&&job.websiteScopeIdentifier.length<=120?
      job.websiteScopeIdentifier:null,
    style_compliance:'not_evaluated'
   });
  });
  next.by_repository[repo]=aggregate;
 }
 next.recent_transitions=next.recent_transitions.slice(-MAX_RECENT_TRANSITIONS);
 return next;
}
