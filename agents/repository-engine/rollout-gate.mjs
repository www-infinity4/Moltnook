export function assessRollout({candidate,stable,checks,samples,errors,weight=0,migrationsReversible=false}){
 const hold=reason=>({action:'hold',weight:0,reason});
 if(!candidate||candidate.fixture!==false||!candidate.commitSha||candidate.commitSha===stable?.commitSha)return hold('Distinct real candidate and stable release receipts required');
 if(!stable?.versionId||!candidate.versionId)return hold('Cloudflare candidate and rollback version IDs required');
 if(!migrationsReversible)return hold('Migration compatibility and rollback not verified');
 if(!checks||['sourceMatched','browserPassed','purpleApproved'].some(k=>checks[k]!==true))return hold('Source, browser and GPT Purple gates must pass');
 if(!Number.isInteger(samples)||!Number.isInteger(errors)||samples<0||errors<0||errors>samples||![0,.01,.1,.5,1].includes(weight))return hold('Invalid rollout telemetry');
 if(errors>0)return {action:'rollback',weight:0,versionId:stable.versionId,reason:'Canary verification errors observed'};
 if(samples<20)return {action:'observe',weight,reason:'At least 20 verified requests needed before promotion'};
 const next=[.01,.1,.5,1].find(w=>w>weight);
 return next?{action:'promote',weight:next,versionId:candidate.versionId}:{action:'stable',weight:1,versionId:candidate.versionId};
}
