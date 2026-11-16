/**
 * Source-only contract for the proposed private Bubbles Android Security Lab.
 * Pure validators cannot authenticate requests, grant leases, run REA/Frida,
 * verify real-world ownership or seal live-test receipts. The existing signed
 * runner must make those decisions independently; callers must fail closed.
 */
const SHA256=/^[a-f0-9]{64}$/i;
const PACKAGE=/^(?:[a-zA-Z_][\w]*\.)+[a-zA-Z_][\w]*$/;
const CATEGORY=new Set(['function-names','call-counts','synthetic-endpoints','timing']);
const EVIDENCE_KIND=new Set(['function-names','call-counts','synthetic-endpoints','timing','test-result']);
const STAGE=new Set(['scan','trace','build','verify','match','signoff']);
const EVIDENCE_KEYS=new Set(['id','stage','anchor','kind','count','testPassed']);
const ANCHOR=/^[A-Za-z0-9_.\/-]+:[1-9][0-9]{0,7}$/;
const MAX_GRANT_MS=15*60*1000;

export function validateLabProposal(input,{nowMs=Date.now()}={}){
 const errors=[];
 const target=input?.target,grant=input?.grant,observations=input?.observations;
 if(target?.kind!=='synthetic-fixture')errors.push('only synthetic fixtures are accepted in this source-only slice');
 if(!PACKAGE.test(target?.packageId||''))errors.push('invalid fixture package identifier');
 if(!SHA256.test(target?.apkSha256||''))errors.push('invalid fixture APK SHA-256');
 if(!grant||typeof grant.jobId!=='string'||!/^issue:[\w-]+\/[\w.-]+#[1-9]\d{0,7}$/.test(grant.jobId))errors.push('missing existing task identity');
 if(grant?.packageId!==target?.packageId||grant?.apkSha256!==target?.apkSha256)errors.push('grant target does not match fixture');
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(grant?.expiresAtMs)||grant.expiresAtMs<=nowMs||grant.expiresAtMs-nowMs>MAX_GRANT_MS)errors.push('grant expiry is missing, expired or too long');
 if(!Array.isArray(observations)||!observations.length||observations.length>CATEGORY.size||
    observations.some(x=>!CATEGORY.has(x))||new Set(observations).size!==observations.length)errors.push('observation scope must be unique, metadata-only');
 return Object.freeze({valid:errors.length===0,status:errors.length?'rejected':'requires-authenticated-signed-runner',
  errors,executionAuthorized:false,emulatorStarted:false,liveTestVerified:false});
}

/**
 * Filter untrusted structured statements to bounded metadata ONLY.
 * No upstream observation or test assertion is made trustworthy by this step.
 */
export function summarizeLabEvidence(items,{unknowns=[]}={}){
 if(!Array.isArray(items)||items.length>500||!Array.isArray(unknowns)||unknowns.length>200||
  unknowns.some(x=>typeof x!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(x)))throw Error('metadata-only evidence shape required');
 const ids=new Set();
 const safe=[];
 for(const item of items){
  if(!item||typeof item!=='object'||Object.keys(item).some(k=>!EVIDENCE_KEYS.has(k))||
    !/^[\w.:-]{1,100}$/.test(item.id||'')||!STAGE.has(item.stage)||
    !EVIDENCE_KIND.has(item.kind)||!Number.isSafeInteger(item.count)||item.count<0||item.count>1_000_000||
    typeof item.testPassed!=='boolean')throw Error('metadata-only evidence shape required');
  if(!ANCHOR.test(item.anchor||'')||item.anchor.includes('..'))throw Error('source-addressable anchor required');
  if(ids.has(item.id))throw Error('duplicate evidence ID');
  ids.add(item.id);
  safe.push(Object.freeze({id:item.id,stage:item.stage,anchor:item.anchor,
   kind:item.kind,count:item.count,testPassed:item.testPassed}));
 }
 return Object.freeze({status:'unverified-structured-summary',evidenceCount:safe.length,
  reportedPassingChecks:safe.filter(x=>x.testPassed).length,
  reportedFailingChecks:safe.filter(x=>!x.testPassed).length,
  residualUnknowns:unknowns.length,evidence:safe,
  // CI, review, source provenance and emulator receipts are verified elsewhere.
  independentReviewVerified:false,releaseReady:false,productionVerified:false});
}
