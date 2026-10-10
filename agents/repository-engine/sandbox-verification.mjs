import fs from 'node:fs/promises';
const reports=[];
for(const environment of ['sandbox','canary']){
 const origin='https://infinity-bot-'+environment+'.marvaseater.workers.dev';
 const report={environment,origin,verified:false,realGeneration:false,productionRolloutVerified:false};
 try{
  const health=await fetch(origin+'/health',{redirect:'error',signal:AbortSignal.timeout(15000)});const h=await health.json();
  if(!health.ok||h.environment!==environment||h.fixture!==true||h.productionAccess!==false||h.service!=='infinity-bot-fixture')throw Error('Environment identity mismatch');
  const image=await fetch(origin+'/v1/image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:'neon robot brain',mode:'Image',reference_mode:'text-only'}),redirect:'error',signal:AbortSignal.timeout(15000)});const i=await image.json();
  if(!image.ok||i.environment!==environment||i.fixture!==true||i.realGeneration!==false||!i.image?.startsWith('data:image/png;base64,'))throw Error('Fixture image contract mismatch');
  const denied=await fetch(origin+'/v1/wallet/state',{redirect:'error',signal:AbortSignal.timeout(15000)});if(denied.status!==403)throw Error('Wallet isolation failed');
  report.verified=true;report.version=h.version;
 }catch(e){report.error=String(e.message).slice(0,300);process.exitCode=1;}
 reports.push(report);
}
await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/sandbox-verification.json',JSON.stringify(reports,null,2));
for(const r of reports)console.log(r.environment,r.verified?'fixture endpoints verified':'verification failed');
