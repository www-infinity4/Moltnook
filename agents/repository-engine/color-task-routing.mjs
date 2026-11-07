/**
 * A non-privileged routing decision for the already authenticated repository
 * executor. Routing metadata comes from its claimed job, not model-generated
 * page text. This chooses which GPT specialists are useful; it cannot grant a
 * writer lease, import unverified offers, approve a patch, merge, or deploy.
 */
const KINDS=new Set(['repair','import','decision']);
const safePath=p=>typeof p==='string'&&p.length<180&&
 /^[a-zA-Z0-9_.\/-]+$/.test(p)&&!p.startsWith('/')&&
 !p.split('/').some(x=>x==='.'||x==='..'||/^(?:\.git|\.env|secrets?|credentials?|node_modules)$/i.test(x));

export function selectColorPreface(job={},sourcePaths=[]){
 const routing=job?.routing;
 const kind=KINDS.has(routing?.kind)?routing.kind:'auto';
 const targetPaths=Array.isArray(routing?.targetPaths)?routing.targetPaths:[];
 const verified=Array.isArray(sourcePaths)&&targetPaths.length>0&&targetPaths.length<=8&&
  targetPaths.every(p=>safePath(p)&&sourcePaths.includes(p));
 const direct=kind==='repair'&&verified;
 const lane=direct?'green-direct':kind==='import'&&verified?'verified-path-import':
  kind==='decision'?'decision':'investigate';
 return Object.freeze({lane,kind,sourcePathsVerified:verified,
  firstRoles:direct?[]:['red'],
  // Every downstream source write still requires a claimed lease, isolated
  // Green patch, Pink checks, Purple arbitration and target CI/merge gates.
  executionAuthorized:false,importPerformed:false,mergeAuthorized:false});
}

export function selectColorFollowups(plan,redReceipt){
 if(plan?.lane==='green-direct')return [];
 // The absence of an authenticated GPT receipt never implies Red reasoned.
 if(redReceipt?.status!=='model_inference_completed'||!Array.isArray(redReceipt.blockers))return [];
 if(redReceipt.blockers.length||plan?.lane==='decision'||
    (plan?.kind==='import'&&!plan?.sourcePathsVerified))return ['orange'];
 // Blue examines the known source/schema only. The normal Blue plan stage
 // then chooses bounded files; thinking is not ingestion or wallet mutation.
 if(plan?.lane==='verified-path-import')return ['blue'];
 return [];
}
