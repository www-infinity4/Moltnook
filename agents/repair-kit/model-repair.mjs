// Executable repo-local GPT repair adapter. No model-produced shell commands.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const contract=JSON.parse(await fs.readFile('agents/execution-contract.json','utf8'));
const allowed=new Set(['index.html','styles.css','agent-room.css','agent-iteration-card.css']);
const job=JSON.parse(await fs.readFile(process.argv[2]||'agents/model-job.json','utf8'));
const report={schemaVersion:1,jobId:job.id,when:new Date().toISOString(),status:'investigating',runUrl:process.env.GITHUB_RUN_ID?'https://github.com/www-infinity4/Moltnook/actions/runs/'+process.env.GITHUB_RUN_ID:null,events:[]};
const event=(agent,message)=>report.events.push({agent,message,when:new Date().toISOString()});
async function model(input,task){
 const response=await fetch('https://infinity-rogers.marvaseater.workers.dev/v1/chat',{
  method:'POST',headers:{'Content-Type':'application/json','Origin':'https://quantaphi.org'},signal:AbortSignal.timeout(90000),
  body:JSON.stringify({input,context:{application:'Moltnook',assistant:'gpt',task}})});
 if(!response.ok)throw Error('Infinity GPT HTTP '+response.status);
 const data=await response.json(),text=data.output_text||data.output;
 if(typeof text!=='string')throw Error('No model text');
 return JSON.parse(text.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));
}
try{
 if(!job.id||typeof job.acceptance!=='string'||!Array.isArray(job.files)||!job.files.length)throw Error('Incomplete job criteria');
 if(job.files.length>4||job.files.some(p=>!allowed.has(p)))throw Error('Job outside repo-local frontend writer scope');
 const original={};for(const p of job.files)original[p]=await fs.readFile(p,'utf8');
 const excerpts={};for(const [p,text]of Object.entries(original)){const at=text.indexOf(job.focus||'');if(job.focus&&at<0)throw Error('Job focus absent from source');excerpts[p]=job.focus?text.slice(text.lastIndexOf('<p',at),text.indexOf('</p>',at)+4):text.slice(0,2400);}
 event('purple-pearl','Oracle Android design and exact acceptance criteria loaded.');
 const proposal=await model(JSON.stringify({instruction:'Return JSON only: {edits:[{path,after}],reason}. Replace the supplied excerpt with your after string. Correct this exact job. The owner authorizes editing this supplied source. Preserve working controls and wallets. Return at least one edits entry. Do not add external scripts or change integrations.',contract,job,source:excerpts}),'scoped Oracle frontend repair');
 if(Array.isArray(proposal.edits)){proposal.files=proposal.edits.map(e=>{e.before=excerpts[e.path];if(!job.files.includes(e.path)||typeof e.before!=='string'||!e.before||typeof e.after!=='string'||original[e.path].split(e.before).length!==2)throw Error('Edit must match exactly once');return {path:e.path,content:original[e.path].replace(e.before,e.after)};});}
 if(!Array.isArray(proposal.files)||!proposal.files.length||proposal.files.length>4)throw Error('Model returned no scoped edits');
 const unique=new Set();let bytes=0;
 for(const f of proposal.files){
  if(!job.files.includes(f.path)||unique.has(f.path)||typeof f.content!=='string')throw Error('Patch scope mismatch');
  unique.add(f.path);bytes+=Buffer.byteLength(f.content);
  if(bytes>100000)throw Error('Patch exceeds bound');
  // This writer changes presentation only; preserve executable JavaScript and resource destinations.
  if(f.path.endsWith('.html')){
   const scripts=s=>s.match(/<script\b[\s\S]*?<\/script>/gi)||[];
   if(JSON.stringify(scripts(original[f.path]))!==JSON.stringify(scripts(f.content)))throw Error('Presentation writer cannot change scripts');
   const handlers=s=>s.match(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi)||[];
   if(JSON.stringify(handlers(original[f.path]))!==JSON.stringify(handlers(f.content)))throw Error('Presentation writer cannot change event handlers');
   if((f.content.match(/<(?:iframe|object|embed)\b/gi)||[]).length!==(original[f.path].match(/<(?:iframe|object|embed)\b/gi)||[]).length)throw Error('Presentation writer cannot add embedded execution');
   const resources=s=>[...s.matchAll(/\b(?:src|href|action)=["']([^"']+)["']/g)].map(m=>m[1]).sort();
   if(JSON.stringify(resources(original[f.path]))!==JSON.stringify(resources(f.content)))throw Error('Presentation writer cannot change resource destinations');
  }else if(/@import|url\(/i.test(f.content)&&f.content!==original[f.path])throw Error('CSS external resources require separate integration job');
 }
 event('greenbeans','GPT produced '+proposal.files.length+' bounded presentation patches.');
 const review=await model(JSON.stringify({instruction:'Independently review. Return JSON {approved:boolean,reason:string}. Reject changes that do not meet acceptance, damage existing behavior, or fabricate activity.',job,original:excerpts,proposal:{edits:proposal.edits,reason:proposal.reason}}),'independent Pink Panther patch review');
 if(review.approved!==true)throw Error('Independent review: '+review.reason);
 event('pink-panther','Independent model review approved: '+review.reason);
 for(const f of proposal.files)await fs.writeFile(f.path,f.content);
 try{
  execFileSync(process.execPath,['--check','agent-room.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','agent-iteration-card.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--test','agents/tests/routing.test.mjs'],{stdio:'pipe'});
 }catch(error){for(const [p,s]of Object.entries(original))await fs.writeFile(p,s);throw Error('Regression checks failed; patch restored');}
 // Final arbitration happens after independent review and reproducible tests.
 try{
  const arbitration=await model(JSON.stringify({
   instruction:'You are GPT Purple, the final arbiter. Return JSON {decision:"approve"|"reject"|"blocked",reason:string}. Use owner acceptance criteria, the exact edits, independent review and passing test receipts. Approve only when the requested presentation change meets acceptance and preserves existing behavior. Deployment has not been verified; do not declare completion.',
   arbitrator:contract.arbitrator,job,original:excerpts,proposal:{edits:proposal.edits,reason:proposal.reason},
   review,tests:{status:'passed',checks:['node --check agent-room.js','node --check agent-iteration-card.js','node --test agents/tests/routing.test.mjs']},
   deployment:{status:'unverified'}
  }),'GPT Purple final patch arbitration');
  if(!['approve','reject','blocked'].includes(arbitration.decision)||typeof arbitration.reason!=='string'||!arbitration.reason.trim())throw Error('Invalid GPT Purple arbitration response');
  report.arbitration={agent:'gpt-purple',...arbitration};
  event('gpt-purple',arbitration.decision+': '+arbitration.reason);
  if(arbitration.decision!=='approve')throw Error('GPT Purple '+arbitration.decision+': '+arbitration.reason);
 }catch(error){for(const [p,s]of Object.entries(original))await fs.writeFile(p,s);throw error;}
 report.status='tested_patch';report.paths=proposal.files.map(f=>f.path);
 report.next='Configured repository workflow commits and deploys; live Android verification is required before completed.';
 event('pink-panther','Syntax and routing regression tests passed. Deployment remains unverified.');
}catch(error){report.status='blocked';report.error=String(error.message);event('orange-peel',report.error);}
await fs.mkdir('activity',{recursive:true});
await fs.writeFile('activity/model-repair.json',JSON.stringify(report,null,2)+'\n');
console.log(report.status,report.error||report.next);
if(report.status==='blocked')process.exitCode=1;
