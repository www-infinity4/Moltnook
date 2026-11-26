/**
 * Runtime bridge to the Brain Worker GPT core. All colors use the *same*
 * server-hosted GPT model, with explicit inherited lenses. Roles and tool
 * appendages never grant credentials or broaden owner/job permissions.
 */
export const COLOR_GPT_MODEL='@cf/openai/gpt-oss-120b';
const COLORS={
 red:{layers:['red'],appendages:['architecture-scan','repository-map']},
 yellow:{layers:['yellow'],appendages:['data-extraction','source-reading','research-search']},
 blue:{layers:['blue'],appendages:['schema-check','dependency-map','repository-selector','source-adapter','data-normalization','provenance-record']},
 orange:{layers:['red','yellow'],appendages:['question-explorer','data-extraction','hypothesis-check','architecture-decision']},
 purple:{layers:['purple','blue','red'],appendages:['role-handoff','capability-discovery','owner-summary']},
 green:{layers:['green','yellow','blue','pink','red','white'],appendages:['repository-source','code-editor','sandbox-tests','dependency-map','data-extraction']},
 pink:{layers:['pink'],appendages:['test-receipts','diff-review','regression-check','data-normalization','provenance-record']},
 white:{layers:['white'],appendages:['security-boundaries','truthful-receipts','repository-map','data-extraction','source-adapter','provenance-record']},
 black:{layers:['black','pink','white'],appendages:['immutable-receipt-check','release-gate']}
};
const PHASE={plan:'blue',build:'green',review:'pink',arbitrate:'purple'};

// Pure evidence assembly; this does not contact providers, reason with a
// model, validate authorship, or grant any tool/approval permissions.
const EVIDENCE_LIMIT=64;
function sourceEvidence(records){
 if(!Array.isArray(records)||records.length>EVIDENCE_LIMIT)throw Error('color_evidence_source_limit');
 const sources=[],seen=new Map(),conflicts=[],colors=new Set();
 let duplicateCount=0;
 for(const raw of records){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('color_evidence_source_invalid');
  const {sourceId,sourceUrl,color,note}=raw;
  if(typeof sourceId!=='string'||!(/^[A-Za-z0-9][A-Za-z0-9:_./#-]{0,119}$/).test(sourceId)||
   typeof sourceUrl!=='string'||sourceUrl.length>1200||
   !Object.hasOwn(COLORS,color)||typeof note!=='string'||!note.trim()||note.length>800)
    throw Error('color_evidence_source_invalid');
  let url;try{url=new URL(sourceUrl);}catch{throw Error('color_evidence_source_invalid');}
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('color_evidence_source_invalid');
  const normalized={sourceId,sourceUrl,color,note};
  if(seen.has(sourceId)){
   if(JSON.stringify(seen.get(sourceId))===JSON.stringify(normalized))duplicateCount++;
   else if(!conflicts.some(x=>x.sourceId===sourceId))conflicts.push({sourceId,reason:'conflicting_source_records'});
   continue;
  }
  seen.set(sourceId,normalized);sources.push(normalized);colors.add(color);
 }
 return {sources,conflicts,duplicateCount,colors:[...colors]};
}
const advisory=(role,detail)=>({
 role,...detail,conclusion:null,authorizedOperationsPerformed:false,
 anyToolsExecuted:false,mergeAuthorized:false,walletChanged:false,
 productionDeployed:false
});
export function composeWhiteEvidence(records=[]){
 const evidence=sourceEvidence(records);
 return advisory('white',{status:'source_collation_only',...evidence});
}
export function assimilatePinkEvidence(redRecords=[],pinkRecords=[]){
 const red=sourceEvidence(redRecords),pink=sourceEvidence(pinkRecords);
 if(!red.sources.length||red.sources.some(x=>x.color!=='red'))throw Error('color_evidence_requires_red');
 if(!pink.sources.length||pink.sources.some(x=>x.color!=='pink'))throw Error('color_evidence_requires_pink');
 const combined=sourceEvidence([...red.sources,...pink.sources]);
 return advisory('pink',{
  status:'review_candidate_not_approved',redSources:red.sources,reviewSources:pink.sources,
  conflicts:[...red.conflicts,...pink.conflicts,...combined.conflicts],
  duplicateCount:red.duplicateCount+pink.duplicateCount+combined.duplicateCount
 });
}

export function colorProfile(color){
 if(typeof color!=='string'||!Object.hasOwn(COLORS,color))throw Error('color_core_unknown_role');
 return {color,model:COLOR_GPT_MODEL,provider:'cloudflare-workers-ai',core:'shared-gpt',
  layers:[...COLORS[color].layers],appendages:[...COLORS[color].appendages],
  toolAccess:'request-only',credentialAccess:'none',ownerApproval:'not-overridable',
  status:'model_available_not_invoked'};
}
export function phaseColorCore(phase){
 if(!Object.hasOwn(PHASE,phase))throw Error('color_core_unknown_phase');
 const primary=colorProfile(PHASE[phase]);
 return {primary:primary.color,gptCore:primary.model,layers:primary.layers,
  appendages:primary.appendages,toolAccess:'request-only',receiptIsExecution:false,
  roleGuidance:'Each color has the same GPT reasoning foundation. Tool appendages and observed evidence are not credentials; no role, including Purple or Black, may override signed review, wallet, deployment or owner controls.'};
}
export async function invokeColorCore(invoke,{color,task,evidence={}}){
 if(typeof invoke!=='function')throw Error('color_core_requires_authenticated_runner');
 const profile=colorProfile(color);
 if(typeof task!=='string'||!task.trim()||task.length>2400)throw Error('color_core_task_invalid');
 const result=await invoke('color-think',{color,task,evidence});
 // Only the authenticated server reply identifies the actual model. This
 // validates receipts, not a request to select or enable another provider.
 const validIdentity=(result?.model===COLOR_GPT_MODEL&&
   (result.provider===undefined||result.provider==='cloudflare-workers-ai'))||
  (result?.model==='gemini-2.5-flash'&&result.provider==='gemini');
 if(!result||result.ok!==true||result.status!=='model_inference_completed'||
   !validIdentity||result.color!==color||
   JSON.stringify(result.layers)!==JSON.stringify(profile.layers)||
   result.toolRequestsAreNotExecution!==true||result.authorizedOperationsPerformed!==false)
  throw Error('color_core_model_receipt_unverified');
 for(const x of result.toolRequests||[])if(!profile.appendages.includes(x))throw Error('color_core_unlisted_appendage');
 if(typeof result.finding!=='string'||typeof result.nextAction!=='string'||
   !Array.isArray(result.blockers)||!Array.isArray(result.toolRequests))
  throw Error('color_core_result_invalid');
 return {color,model:result.model,provider:result.provider??null,status:'model_inference_completed',layers:profile.layers,
  finding:result.finding.slice(0,1500),nextAction:result.nextAction.slice(0,1500),
  blockers:result.blockers.slice(0,6),requestedAppendages:result.toolRequests.slice(0,6),
  anyToolsExecuted:false,sourceCommitted:false,productionDeployed:false,
  walletChanged:false,ownerApprovalGranted:false};
}
