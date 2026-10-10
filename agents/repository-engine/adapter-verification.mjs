import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {executionContext} from './execution-context.mjs';
export async function verifyAdapters({fetcher=fetch,walletToken='',githubToken='',context=executionContext()}={}){
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),mode:'live_read_only',adapters:{}};
 if(!context.productionAccess){report.mode='isolated';for(const name of ['deployment','catalog','wallet','images','forks'])report.adapters[name]={status:'disabled_isolated_context',executionVerified:false};return report;}
 async function read(url,headers={},validate=()=>true){
  try{const response=await fetcher(url,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return {status:'failed',httpStatus:response.status};
   const payload=await response.json();return {status:validate(payload)?'verified_read':'invalid_response',httpStatus:response.status};
  }catch{return {status:'failed',reason:'Live request failed or returned invalid JSON'};}
 }
 report.adapters.deployment={...await read('https://quantaphi.org/health',{},p=>p.ok===true&&p.service==='quantaphi-site'),executionVerified:false,reason:'Health checks do not prove deployment, migrations, or rollback'};
 report.adapters.catalog=await read('https://quantaphi.org/infinite-book-catalog.json',{},p=>Number.isInteger(p.version)&&Array.isArray(p.sectors)&&p.sectors.length>0&&p.sectors.every(s=>typeof s.name==='string'&&Number.isInteger(s.id)));
 report.adapters.wallet=walletToken?await read('https://unified-wallet.marvaseater.workers.dev/v1/wallet/state',{authorization:'Bearer '+walletToken},p=>p&&typeof p==='object'&&!Array.isArray(p)&&p.ok!==false&&Object.keys(p).some(k=>/wallet|balance|token|asset|state/i.test(k))):{status:'credential_missing',reason:'No device wallet token supplied; no balances changed'};
 report.adapters.images={...await read('https://infinity-rogers.marvaseater.workers.dev/health',{},p=>p.ok===true),executionVerified:false,reason:'Renderer health is not proof of a generated image; generation requires a separate job receipt'};
 report.adapters.forks=githubToken?{...await read('https://api.github.com/repos/www-infinity4/Moltnook',{authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json'},p=>p.full_name==='www-infinity4/Moltnook'),executionVerified:false,reason:'Repository read does not prove fork creation or isolated deployment'}:{status:'credential_missing',executionVerified:false};
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await verifyAdapters({context:executionContext(),walletToken:process.env.WALLET_READ_TOKEN||'',githubToken:process.env.REPOSITORY_WRITE_TOKEN||''});
 await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/adapter-verification.json',JSON.stringify(report,null,2));
 for(const [name,result]of Object.entries(report.adapters))console.log(name,result.status,result.executionVerified===false?'execution not verified':'');
}
