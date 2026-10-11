import {execFileSync} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const nodeTestBootstrap=fileURLToPath(new URL('./node-test-globals.mjs',import.meta.url));
export function focusedTestCommand(files,packageJson){
 if(packageJson?.scripts?.test)return null;
 return files.length?['--import',nodeTestBootstrap,'--test',...files]:null;
}
export async function inspectRuntime({version=process.versions.node,execute=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',timeout:10000}),renderer=async()=>{const {chromium}=await import('playwright');await access(chromium.executablePath());}}={}){
 const checks=[{name:'Node 22 or newer',passed:Number(version.split('.')[0])>=22}];
 for(const [name,cmd]of [['Git','git'],['Python','python3']]){
  try{execute(cmd,['--version']);checks.push({name,passed:true});}catch{checks.push({name,passed:false});}
 }
 try{await renderer();checks.push({name:'Playwright and installed Chromium',passed:true});}catch{checks.push({name:'Playwright and installed Chromium',passed:false});}
 const adapters={github:'credential and target access checked by executor',queue:'authenticated claim required',ai:'execution required for each model stage',sourcePreview:checks.at(-1).passed?'renderer installed':'renderer missing',deployment:'not implemented for arbitrary repositories',walletCatalog:'execution not verified',imageGeneration:'execution not verified',forkCreation:'not implemented'};
 return {schemaVersion:1,checks,adapters,passed:checks.every(x=>x.passed),note:'Local runtime checks; these do not prove remote API credentials or deployment.'};
}

export function missingAcceptanceAdapterMessage(paths){
 const files=Array.isArray(paths)?paths:[];
 if(files.length&&files.every(file=>/\.(?:md|markdown|txt)$/i.test(file)))return 'Documentation-only patch has no executable acceptance check. Do not claim test or browser results that the runner has not verified. If this task requires software behavior, edit actual planned source or add a focused test that runs; if it only requests an unverified report, record the missing evidence instead of presenting success.';
 return 'Repository needs a configured test or build acceptance adapter before committing this file type. Do not invent a passing test or browser receipt.';
}
