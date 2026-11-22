/**
 * Make bounded model requests to the signed Brain executor. The Brain rejects
 * evidence JSON above 125,000 characters. Preserve immutable source windows,
 * exact edits, the owner request and verification results in full; only shrink
 * optional repository inventories and contextual summaries. Never confuse a
 * model-size failure with a missing owner grant or a completed Green patch.
 */
export const MODEL_EVIDENCE_LIMIT=100000;
const size=value=>JSON.stringify(value).length;
const words=value=>new Set(String(value||'').toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g)||[]);
function preferredPaths(paths,task,sourceSamples,max){
 const terms=words(task);
 const explicit=new Set(String(task||'').match(/[A-Za-z0-9_.\/-]+\.(?:js|mjs|cjs|ts|tsx|html|css|py|json|md|ya?ml)\b/g)||[]);
 const sampled=new Set(Object.keys(sourceSamples||{}));
 return paths.map((path,index)=>({path,index,score:(explicit.has(path)?10000:0)+(sampled.has(path)?5000:0)+
  [...terms].reduce((n,t)=>n+(path.toLowerCase().includes(t)?3:0),0)+
  (/(?:^|\/)(?:index\.html|README\.md|AGENTS\.md)$/.test(path)?5:0)}))
  .sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,max).map(x=>x.path);
}
const shorten=(value,max)=>typeof value==='string'&&value.length>max?
 value.slice(0,max)+'\n[Bounded context: full pinned file remains in the authenticated checkout]':value;

export function budgetModelEvidence(evidence,{limit=MODEL_EVIDENCE_LIMIT}={}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return evidence;
 if(!Number.isInteger(limit)||limit<1000||limit>120000)throw Error('model_evidence_limit_invalid');
 const originalChars=size(evidence);
 if(originalChars<=limit)return evidence;
 const result=structuredClone(evidence),reductions=[];
 const shrink=(label,callback)=>{
  if(size(result)<=limit)return;
  const before=size(result);callback();
  if(size(result)<before)reductions.push(label);
 };
 // The dependency trees are read-only discovery inventories; their pinned
 // commit and verified file/blob receipts must stay untouched.
 shrink('dependency_tree_inventory',()=>{
  for(const repo of result.dependencyContext?.repositories||[]){
   if(Array.isArray(repo.tree)&&repo.tree.length>30){
    repo.treeTotal=repo.treeTotal??repo.tree.length;
    repo.treeExcerpt=true;
    repo.tree=preferredPaths(repo.tree,result.task,result.sourceSamples,30);
   }
  }
 });
 shrink('reader_source_tree',()=>{
  if(Array.isArray(result.tree)&&result.tree.length>420){
   result.treeTotal=result.tree.length;
   result.tree=preferredPaths(result.tree,result.task,result.sourceSamples,420);
  }
 });
 shrink('scoped_capability_inventory',()=>{
  const c=result.scopedCapabilities;
  if(!c)return;
  for(const [key,max] of [['existingWorkflows',6],['knownSourcePaths',45],['sourcePathFilters',8],['testCommands',12],['permissions',8]])
   if(Array.isArray(c[key])&&c[key].length>max)c[key]=c[key].slice(0,max);
 });
 shrink('feature_manifest_inventory',()=>{
  if(Array.isArray(result.featureManifest?.checks)&&result.featureManifest.checks.length>12)
   result.featureManifest.checks=result.featureManifest.checks.slice(0,12);
 });
 shrink('general_readme',()=>{result.readme=shorten(result.readme,6500);result.sourceSummary=shorten(result.sourceSummary,2200);});
 shrink('agent_context',()=>{result.agents=shorten(result.agents,11000);});
 shrink('sampled_source_excerpts',()=>{
  if(result.sourceSamples&&typeof result.sourceSamples==='object')for(const path of Object.keys(result.sourceSamples))
   result.sourceSamples[path]=shorten(result.sourceSamples[path],1700);
 });
 shrink('read_only_source_briefs',()=>{
  for(const d of result.taskBriefs?.documents||[]){
   if(d.status==='complete_pinned_brief'&&typeof d.text==='string'&&d.text.length>6000){
    d.totalChars=d.text.length;d.text=shorten(d.text,6000);
    d.status='bounded_model_excerpt_of_complete_pinned_brief';d.truncated=true;
   }
  }
 });
 shrink('advisory_model_findings',()=>{
  for(const r of Object.values(result.colorFindings||{})){
   for(const field of ['finding','nextAction'])if(typeof r?.[field]==='string')r[field]=shorten(r[field],750);
   if(Array.isArray(r?.blockers))r.blockers=r.blockers.slice(0,4);
  }
 });
 // Source, edits, acceptance tests, lease, owner instructions and hashes are
 // intentionally NOT reduced. A large immutable source requires a narrower
 // authorized job/window, not an inaccurate partial diff or false approval.
 if(size(result)+250>limit)throw Error('model_evidence_cannot_fit_immutable_context: '+size(result)+' characters; require a smaller pinned source window or scoped job');
 result.evidenceBudget={originalChars, reductions,fullPinnedCheckoutRetained:true,
  exactSourceAndEditsUnchanged:true,modelContextSummarized:true};
 if(size(result)>limit)throw Error('model_evidence_cannot_fit_immutable_context');
 return result;
}
