/**
 * Signed-runner automation recipe descriptors (not a second executor).
 * No descriptor grants permissions, creates a lease, performs a network call,
 * schedules a job, persists a checkpoint or approves external effects.
 * The existing Brain coordinator/runner owns those stages and their receipts.
 */
const entries=[
 ['github',['manual','event','schedule'],['read_ticket','deduplicate','claim_existing_lease','build_branch','exact_head_tests','independent_review','guarded_merge'],false],
 ['quick-card',['manual','event'],['verify_primary_source','validate_rights','draft_card','review_assets','test_android','guarded_release'],true],
 ['creative',['manual','event'],['source_brief','draft_creative','check_rights','review','publish_if_authorized'],true],
 ['media',['manual','schedule','event'],['check_licensed_media','deduplicate','draft_playlist','review','publish_if_authorized'],true],
 ['product',['manual','event'],['verify_official_product_source','validate_current_stock','draft_catalog','review','publish_if_authorized'],true],
 ['public-research',['manual','schedule','poll'],['check_official_sources','record_provenance','compare_changes','draft_answer','human_handoff'],false],
 ['owner-routine',['manual','schedule','webhook'],['verify_owner_scope','load_checkpoint','draft_action','require_consent','log_receipt'],true]
];
export const AUTOMATION_RECIPES=Object.freeze(entries.map(([id,triggers,steps,externalEffect])=>
 Object.freeze({id,triggers:Object.freeze(triggers),steps:Object.freeze(steps),
  externalEffect,provenance:'owner-signed-runner'})));
const validKey=key=>typeof key==='string'&&key.length>=4&&key.length<=160&&/^[a-zA-Z0-9._:/#-]+$/.test(key);
const validSource=value=>{
 if(typeof value!=='string'||value.length>1000)return false;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}
};
const CHECKPOINT=Object.freeze(['sourceSha','leaseId','stage','attempt','lastError','nextAttemptAt','receipts']);
const RETRY=Object.freeze({maxAttempts:3,policy:'bounded_exponential_backoff',retryOnlyIdempotent:true});
export function planAutomationRecipe(input={}){
 const recipe=AUTOMATION_RECIPES.find(x=>x.id===input?.recipeId);
 const trigger=input?.trigger;
 const eligible=!!recipe&&recipe.triggers.includes(trigger)&&validKey(input.dedupeKey)&&validSource(input.sourceUrl);
 return Object.freeze({
  recipeId:recipe?.id||null,trigger:typeof trigger==='string'?trigger:null,
  dedupeKey:eligible?input.dedupeKey:null,sourceUrl:eligible?input.sourceUrl:null,
  status:!eligible?'blocked':recipe.externalEffect&&trigger!=='manual'?'approval_required':'ready_for_claim',
  approvalRequired:recipe?.externalEffect===true,
  approvalGranted:false,executionAuthorized:false,checkpoint:CHECKPOINT,retry:RETRY,
  runner:'existing_signed_lease_bound_runner',durableStateCreated:false,externalEffectPerformed:false
 });
}
