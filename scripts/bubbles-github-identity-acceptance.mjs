// Real signed conversation evidence. Read-only; never creates a work ticket.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {signed} from './bubbles-chat-verified-benchmark.mjs';
export function gradeIdentityReply(reply,{negative=false}={}) {
 const body=reply?.result||{},receipt=body.receipt||{};
 const urls=[body.sourceUrl,...(Array.isArray(body.sources)?body.sources.map(s=>s?.url):[])].filter(x=>typeof x==='string');
 const exactSource=urls.some(value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&/^\/www-infinity4\/QuantaPhi\/blob\/[^/]+\/README\.md$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}});
 const delivered=reply?.state==='complete'&&body.ok===true&&typeof body.output==='string'&&body.output.trim().length>0;
 const read=receipt.sourceReadVerified===true&&receipt.status==='complete'&&['github.read_file','agent.read_sequence'].includes(receipt.tool);
 const pass=negative?delivered&&receipt.tool==='github.read_file'&&['failed','needs_input'].includes(receipt.status)&&receipt.sourceReadVerified!==true:
  delivered&&read&&exactSource&&(body.repository===undefined||body.repository==='www-infinity4/QuantaPhi')&&(body.path===undefined||body.path==='README.md');
 return {pass,delivered,exactSource,sourceReadVerified:receipt.sourceReadVerified===true,
  tool:receipt.tool||null,receiptStatus:receipt.status||null,repository:body.repository||null,
  sourceUrls:urls,output:body.output||'',writeVerified:false,deploymentVerified:false};
}
export async function main() {
 const report={status:'started',runId:process.env.GITHUB_RUN_ID,checks:[],writeVerified:false,deploymentVerified:false};
 mkdirSync('repository-receipts',{recursive:true});
 try {
  const u=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);u.searchParams.set('audience','bubbles-owner-message-bridge');
  const r=await fetch(u,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!r.ok)throw Error('signed_identity_unavailable');
  const token=(await r.json()).value;if(!token)throw Error('signed_identity_missing');
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const approval=await signed(headers,{operation:'status'},15000);
  if(approval.jobId!=='chatgpt_runner_'+process.env.GITHUB_RUN_ID)throw Error('signed_run_identity_mismatch');
  const probes=[
   {text:'Read README.md from public GitHub repository www-infinity4/QuantaPhi. Return one actual file detail and its exact GitHub source URL. Do not claim repository writes, deployment, or Android testing. A conversation reply alone is not proof of reading.'},
   {negative:true,text:'Read README.md from the exact public repository www.infinity4/QuantaPhi. The owner contains a period after www. Do not substitute www-infinity4 or silently correct this explicit test target. If this exact source cannot be read, return the actual failed read receipt and say it was not read. Do not claim a successful read or any edit.'}
  ];
  for(let turn=0;turn<probes.length;turn++) {
   const probe=probes[turn];
   try {
    await signed(headers,{operation:'assist',turn,text:probe.text},120000);
    const reply=await signed(headers,{operation:'result',turn},15000);
    if(reply.jobId!=='chatgpt_assist_'+process.env.GITHUB_RUN_ID+'_'+turn)throw Error('result_run_identity_mismatch');
    report.checks.push({negative:probe.negative===true,...gradeIdentityReply(reply,probe)});
   }catch(e){report.checks.push({negative:probe.negative===true,pass:false,error:String(e.message).slice(0,200)});}
  }
  report.status=report.checks.length===2&&report.checks.every(x=>x.pass)?'passed':'failed';
 }catch(e){report.status='blocked';report.error=String(e.message).slice(0,200);}
 finally {
  writeFileSync('repository-receipts/bubbles-github-identity.json',JSON.stringify(report,null,2)+'\n');
  console.log('BUBBLES_GITHUB_IDENTITY '+JSON.stringify(report));
  if(report.status!=='passed')process.exitCode=1;
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
