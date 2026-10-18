/** Bounded color-agent delegation. A registered child is a task packet, never a new credential. */
import {createHash} from 'node:crypto';
import {colorProfile,invokeColorCore} from './repository-engine/color-core.mjs';

export const DEFAULT_LIMITS = Object.freeze({maxDepth:3,maxChildrenPerParent:3,maxAgents:120});
export const READ_ONLY_TOOLS = Object.freeze(['github-public-read','moltnook-evidence-write']);
const ROLE_ORDER = Object.freeze({
  green:['yellow','pink','black'], blue:['yellow','green','pink'],
  yellow:['blue','pink','purple'], orange:['yellow','blue','pink'],
  pink:['yellow','green','black'], purple:['blue','green','black'],
  black:['pink','purple','yellow'], red:['yellow','blue','pink'],
  white:['pink','yellow','purple']
});
const RESPONSIBILITIES = Object.freeze({
  yellow:['Read pinned repository mission and source evidence','Source README and immutable commit inspected'],
  blue:['Validate routes, file scope and repository assumptions','Expected file paths checked and missing paths reported'],
  green:['Inspect implementation targets and plan an isolated patch','Implementation paths verified; real edits require separate authorized runner'],
  pink:['Review CI, regression and reproducibility evidence','Workflow result recorded and unresolved checks identified'],
  orange:['Identify contradictions and blockers','Open questions and missing proof explicitly reported'],
  purple:['Summarize verified results for the owner','Readable handoff includes source link and truthful execution status'],
  black:['Seal evidence without implying deployment','Source, tests and deployment independently classified'],
  white:['Guard truthfulness, owner boundaries and source-versus-deploy claims','Unverified actions left explicitly unverified'],
  red:['Read broad context before handing to specialists','Scope and source records inspected']
});
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,45);
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const validString=s=>typeof s==='string'&&s.length>0&&s.length<2000;
const unique=a=>[...new Set(a)];

/** Any registered color parent may delegate, including children (up to maxDepth). */
export function spawnColorChild({agents,roster,parentId,job,roleId,task,completion,now,limits=DEFAULT_LIMITS}) {
  if(!Array.isArray(agents)||!Array.isArray(roster)||!job||!validString(job.id)||!validString(job.repo))throw Error('Valid registry, roster and scoped job required');
  const parent=agents.find(a=>a.id===parentId);
  const role=roster.find(a=>a.id===roleId);
  if(!parent||!role||!RESPONSIBILITIES[role.color])throw Error('Registered parent and color role required');
  if(parent.jobId!==job.id)throw Error('Child cannot leave parent job scope');
  const depth=(parent.depth??1)+1;
  if(depth>limits.maxDepth)throw Error('Maximum delegation depth reached');
  if(!validString(task)||!validString(completion))throw Error('Task and measurable completion condition required');
  const id='child-'+slug(job.id)+'-'+hash(parent.id+'|'+job.id+'|'+role.id);
  const existing=agents.find(a=>a.id===id);
  if(existing) {
    if(existing.parentId!==parent.id||existing.jobId!==job.id||existing.roleId!==role.id)throw Error('Conflicting child registration');
    return {agent:existing,created:false};
  }
  if(agents.length>=limits.maxAgents)throw Error('Color-agent registry is full');
  if(agents.filter(a=>a.parentId===parent.id).length>=limits.maxChildrenPerParent)throw Error('Parent child limit reached');
  const parentTools=Array.isArray(parent.tools)?parent.tools:READ_ONLY_TOOLS;
  const tools=READ_ONLY_TOOLS.filter(t=>parentTools.includes(t));
  const permissions=unique((parent.permissions||[]).filter(x=>['read public repository','write Moltnook evidence'].includes(x)));
  const child={id,name:role.name+' · '+job.id+' helper',color:role.color,jobId:job.id,
    parent:parent.id,parentId:parent.id,roleId:role.id,depth,job:task,task,
    completion,repo:job.repo,sourceUrl:job.sourceUrl||null,tools,permissions,
    status:'delegated',createdAt:now,receipt:null,modelCore:colorProfile(role.color),
    execution:'evidence-only until an authenticated GPT role call produces a separate model receipt; no commit, deploy or wallet grant'};
  agents.push(child);
  return {agent:child,created:true};
}

/** Suggest useful complementary specialists; the parent chooses bounded child roles. */
export function selectChildRoles(parent,roster,count=3) {
  const colors=ROLE_ORDER[parent?.color]||ROLE_ORDER.purple;
  const preferred={yellow:'naked-gold-digger',blue:'blueberry',green:'greenbeans',pink:'pink-panther',
    orange:'orange-peel',purple:'purple-pearl',black:'black-seal',red:'red-macro-reader',white:'white-lens'};
  return colors.map(color=>roster.find(a=>a.id===preferred[color])||roster.find(a=>a.color===color))
    .filter(Boolean).slice(0,count).map(a=>a.id);
}

/** This runner truly performs read-only inspections, so receipts may only state those inspections. */
export function inspectChild({child,job,head,mission,checks=[],ci,now}) {
  if(child.jobId!==job.id||child.repo!==job.repo)throw Error('Child evidence outside scope');
  const missing=checks.filter(c=>!c.found).map(c=>c.path);
  const sourceUrl=head?.url||job.sourceUrl||null;
  const role=child.color;
  let result='Repository evidence inspection complete';
  if(role==='yellow'||role==='red')result=mission&&head?'README and pinned commit observed':'Source mission or commit unavailable';
  else if(role==='blue')result=missing.length?'Missing expected paths: '+missing.join(', '):'All '+checks.length+' expected paths observed';
  else if(role==='green')result='Checked '+checks.length+' implementation paths; source changes not attempted';
  else if(role==='pink')result=ci?'Observed CI status: '+ci.status+' (not deployment proof)':'No completed CI result available';
  else if(role==='black'||role==='white')result='Release NOT verified: no authenticated deployment-and-browser acceptance receipt';
  else if(role==='orange')result=missing.length?'Blocker: missing paths '+missing.join(', '):'No missing path found; runtime behavior unverified';
  else if(role==='purple')result='Repository observed; implementing and publishing require scoped execution receipts';
  const blocked=!head||missing.length>0||role==='black'||role==='white'||(role==='pink'&&ci?.status!=='success');
  return {...child,status:blocked?'needs_work':'inspected',lastCheckedAt:now,
    receipt:{kind:'github-read-only-evidence',when:now,sourceUrl,commitSha:head?.sha||null,
      workflowUrl:ci?.url||null,observedFiles:checks.length,missingFiles:missing,
      codeWritten:false,deployed:false,walletChanged:false,result}};
}

export function parentReport(agents,parentId) {
  const children=agents.filter(a=>a.parentId===parentId);
  return {parentId,childIds:children.map(c=>c.id),childCount:children.length,
    inspected:children.filter(c=>c.status==='inspected').length,
    needsWork:children.filter(c=>c.status==='needs_work').length,
    scope:'read-only GitHub observations, not independent agents or source changes'};
}
export function responsibilitiesFor(color) {return RESPONSIBILITIES[color]||RESPONSIBILITIES.purple;}

/** Optional real GPT inference for a previously registered child.
 * The caller must supply the authenticated lease-bound Robot Brain call()
 * callback. Mere registration never runs a model or grants a new tool.
 */
export async function reasonColorChild({agents,childId,invoke,evidence={}}){
 if(!Array.isArray(agents))throw Error('Color agent registry required');
 const index=agents.findIndex(a=>a.id===childId);
 if(index<0)throw Error('Unknown registered color agent');
 const child=agents[index];
 if(!child.jobId||!child.repo||!child.color)throw Error('Color child is not scoped');
 const receipt=await invokeColorCore(invoke,{
  color:child.color,task:child.task||child.job,evidence:{...evidence,jobId:child.jobId,repository:child.repo}
 });
 const next={...child,modelCore:{...colorProfile(child.color),status:'model_inference_completed'},
  modelReceipt:receipt,execution:'GPT model inference verified; source edits, approvals, deployment and payments remain unverified'};
 agents[index]=next;
 return next;
}
