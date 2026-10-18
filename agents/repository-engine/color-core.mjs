/**
 * Runtime bridge to the Brain Worker GPT core. All colors use the *same*
 * server-hosted GPT model, with explicit inherited lenses. Roles and tool
 * appendages never grant credentials or broaden owner/job permissions.
 */
export const COLOR_GPT_MODEL='@cf/openai/gpt-oss-120b';
const COLORS={
 red:{layers:['red'],appendages:['architecture-scan','repository-map']},
 yellow:{layers:['yellow'],appendages:['data-extraction','source-reading','research-search']},
 blue:{layers:['blue'],appendages:['schema-check','dependency-map','repository-selector']},
 orange:{layers:['red','yellow'],appendages:['question-explorer','data-extraction','hypothesis-check']},
 purple:{layers:['purple','blue','red'],appendages:['role-handoff','capability-discovery','owner-summary']},
 green:{layers:['green','yellow','blue','pink','red','white'],appendages:['repository-source','code-editor','sandbox-tests','dependency-map','data-extraction']},
 pink:{layers:['pink'],appendages:['test-receipts','diff-review','regression-check']},
 white:{layers:['white'],appendages:['security-boundaries','truthful-receipts']},
 black:{layers:['black','pink','white'],appendages:['immutable-receipt-check','release-gate']}
};
const PHASE={plan:'blue',build:'green',review:'pink',arbitrate:'purple'};
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
 if(!result||result.ok!==true||result.status!=='model_inference_completed'||
   result.model!==profile.model||result.color!==color||
   JSON.stringify(result.layers)!==JSON.stringify(profile.layers)||
   result.toolRequestsAreNotExecution!==true||result.authorizedOperationsPerformed!==false)
  throw Error('color_core_model_receipt_unverified');
 for(const x of result.toolRequests||[])if(!profile.appendages.includes(x))throw Error('color_core_unlisted_appendage');
 if(typeof result.finding!=='string'||typeof result.nextAction!=='string'||
   !Array.isArray(result.blockers)||!Array.isArray(result.toolRequests))
  throw Error('color_core_result_invalid');
 return {color,model:profile.model,status:'model_inference_completed',layers:profile.layers,
  finding:result.finding.slice(0,1500),nextAction:result.nextAction.slice(0,1500),
  blockers:result.blockers.slice(0,6),requestedAppendages:result.toolRequests.slice(0,6),
  anyToolsExecuted:false,sourceCommitted:false,productionDeployed:false,
  walletChanged:false,ownerApprovalGranted:false};
}
