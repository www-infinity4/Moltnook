// Read-only compatibility probe for the previously-pinned Browser Bridge edge.
// Header agreement is ONLY permission to run the strict full HTML/browser check,
// never evidence of a deployed or approved repair.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {expectedEdgeVersion} from './repair-finalize-edge.mjs';

const ENDPOINT='https://quantaphi.org/?repairEdgePreflight=1';

export async function edgePreflight({mode='scheduled',fetchImpl=fetch}={}){
 const base={schemaVersion:1,checkedAt:new Date().toISOString(),mode,
  expectedEdgeVersion,observedEdgeVersion:null,statusCode:null,
  ready:false,deploymentVerified:false,mergeAttempted:false,
  status:'preflight_request_failed',reason:'Edge request not completed',
  note:'Read-only version-header probe; never a source/hash/browser acceptance receipt'};
 try{
  const response=await fetchImpl(ENDPOINT,{method:'GET',redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(20000)});
  base.statusCode=response.status;
  base.observedEdgeVersion=response.headers?.get?.('x-quantaphi-edge')||null;
  // Stop downloading the homepage once the version header is read.
  try{await response.body?.cancel?.()}catch{}
  if(!response.ok){
   base.status='preflight_http_failed';base.reason='Live edge returned HTTP '+response.status;
  }else if(base.observedEdgeVersion!==expectedEdgeVersion){
   base.status='deferred_edge_version_drift';
   base.reason='Live Worker edge version differs from the pinned source transform; release is deferred';
  }else{
   base.status='compatible_header_only';base.ready=true;
   base.reason='Edge version agrees; full exact HTML and browser checks are still required';
  }
 }catch{
  // Do not log request exceptions: they may contain private headers or URLs.
  base.reason='Read-only edge probe unavailable; deployment unverified';
 }
 return base;
}

export function preflightExitCode(report,mode){
 if(report.ready)return 0;
 // Only a known HTTP-successful, explicitly different edge version is
 // a deferred scheduled dependency; all network/HTTP failures still fail.
 if(mode==='scheduled'&&report.status==='deferred_edge_version_drift')return 0;
 return 1;
}

async function main(){
 const mode=process.env.EDGE_PREFLIGHT_MODE==='scheduled'?'scheduled':'apply';
 const report=await edgePreflight({mode});
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/repair-edge-preflight.json',JSON.stringify(report,null,2));
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,
  'ready='+String(report.ready)+'\nstatus='+report.status+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
  '### Browser Bridge edge preflight\n'+
  '**'+report.status+'** — '+report.reason+'\n\n'+
  'Expected: `'+report.expectedEdgeVersion+'`  Observed: `'+(report.observedEdgeVersion||'unavailable')+
  '`\n\nNo deployment, merge, or acceptance was verified by this preflight.\n');
 if(!report.ready)console.warn('::warning::Browser repair '+report.status+': '+report.reason);
 console.log(JSON.stringify(report));
 process.exitCode=preflightExitCode(report,mode);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 main().catch(error=>{console.error('Edge preflight receipt write failed: '+String(error.message).slice(0,120));process.exitCode=1});
