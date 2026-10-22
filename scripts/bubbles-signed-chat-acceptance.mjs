// Owner-requested reconnect check: 2026-10-22T04:15Z; reuse existing signed consent.
// Synthetic, owner-approved Bubbles chat QA via the existing short-lived GitHub
// OIDC identity. Never reads private conversations or authorizes website taps.
import {writeFile,mkdir} from 'node:fs/promises';
const ENDPOINT='https://bubbles-cloud-browser.marvaseater.workers.dev/v1/browser/chatgpt/runner';
const prompts=[
 {
  "name": "multi_repository",
  "text": "Inspect the public repository www-infinity4/QuantaPhi, list its root entries, then find and read its main README documentation. Explain its purpose using the actual file content."
 },
 {
  "name": "multi_weather_news",
  "text": "Get the current weather in Lovilia, Iowa and the latest US news headlines. Perform both lookups and explain the results clearly."
 },
 {
  "name": "runtime_inventory",
  "text": "What server runtime and tools are you actually using right now? Explain what you can execute here and which capabilities still need separate connections. Do not claim a shell, Python or browser session was opened."
 },
 {
  "name": "two_town_weather",
  "text": "What is the weather in Lovilia, Iowa and Ottumwa, Iowa today? Check each town separately. Use available tools, explain the actual conditions and name the date; do not narrate tool commands."
 },
 {
  "name": "weather_followup",
  "text": "Which of those two towns is warmer? Use our preceding answer and tell me clearly, without making me restate the towns."
 },
 {
  "name": "page_understanding",
  "text": "Inspect https://quantaphi.org/bubbles.html and explain what the Bubbles page offers. Distinguish what you inspected from assumptions and never pretend a screenshot was inspected."
 }
];
function clean(s,n=1600){return String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n);}
async function request(headers,payload,ms){
 const r=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(ms)});
 let data={};try{data=await r.json()}catch{}
 if(!r.ok||data.ok!==true)throw Error('signed_'+payload.operation+'_http_'+r.status+'_'+clean(data.error,90));
 return data;
}
async function main(){
 const identityUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'');
 identityUrl.searchParams.set('audience','bubbles-owner-message-bridge');
 const idr=await fetch(identityUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!idr.ok)throw Error('oidc_identity_http_'+idr.status);
 const token=(await idr.json()).value;
 if(typeof token!=='string'||!token)throw Error('oidc_missing');
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const approval=await request(headers,{operation:'status'},15000);
 if(approval.jobId!=='chatgpt_runner_'+process.env.GITHUB_RUN_ID)throw Error('wrong_signed_run_identity');
 const report={checkedAt:new Date().toISOString(),scope:'signed synthetic public Bubbles conversation only',approvalVerified:true,
 ownerUiVerified:false,androidVerified:false,repositoryWrites:0,results:[]};
 for(let turn=0;turn<prompts.length;turn++){
  const p=prompts[turn],result={turn,name:p.name};
  try{
   const a=await request(headers,{operation:'assist',text:p.text,turn},120000);
   const b=await request(headers,{operation:'result',turn},15000);
   result.state=b.state;
   result.receipt=b.result?.receipt||null;
   result.sources=(b.result?.sources||[]).map(s=>({title:clean(s.title,80),url:clean(s.url,250)})).slice(0,6);
   result.output=clean(b.result?.output||'',1200);
   result.complete=a.state==='complete'&&b.state==='complete'&&b.result?.ok===true;
   result.hasRawToolDraft=/\{\s*"(?:tool|name|arguments|query)"\s*:|(?:^|\s)(?:web\.search|weather\.current|github\.create_repository)\s*\(/im.test(result.output);
   result.hasUnprovenTap=p.name==='card_tap_limit'&&/\b(?:i (?:clicked|tapped|pressed)|successfully (?:clicked|tapped|opened)|i've opened)\b/i.test(result.output);
   if(p.name.startsWith('multi_'))result.actualMultiRead=result.receipt?.tool==='agent.read_sequence'&&result.receipt?.status==='complete'&&result.sources.length>0;
   if(p.name.startsWith('termux_'))result.claimedUnverifiedDeviceExecution=result.receipt?.tool==='oracle.chat'&&/\b(?:i (?:ran|executed)|python (?:ran|executed) successfully|exit(?: code)?[=: ]+0|cleanup (?:confirmed|completed))\b/i.test(result.output);
   if(['simple_search','google_search'].includes(p.name))result.actualSearchTool=result.receipt?.tool==='web.search'&&result.receipt?.status==='complete'&&result.sources.length>0;
   if(p.name==='two_town_weather')result.actualWeatherTool=result.receipt?.tool==='weather.current'&&result.receipt?.status==='complete'&&/Lovilia/i.test(result.output)&&/Ottumwa/i.test(result.output);
   if(p.name==='page_understanding')result.actualPublicPageRead=result.receipt?.tool==='web.read_page'&&result.receipt?.status==='complete'&&result.sources.some(s=>s.url==='https://quantaphi.org/bubbles.html');
   if(p.name==='weather_followup')result.retainedLocations=/Lovilia/i.test(result.output)&&/Ottumwa/i.test(result.output);
   if(p.name==='source_research')result.twoRealSources=result.sources.filter(s=>/^https:\/\//.test(s.url)).length>=2;
   if(p.name==='source_research')result.synthesizedResearch=!/^Live results from /i.test(result.output)&&/hydrogen/i.test(result.output)&&/\b(?:compressed|liquid|pressure|hydride|solid|storage)\b/i.test(result.output)&&result.output.length>=90;
  }catch(e){result.error=clean(e.message,160);result.complete=false;}
  report.results.push(result);
  console.log('BUBBLES_CHAT_QA '+JSON.stringify(result));
 }
 report.completed=report.results.filter(x=>x.complete).length;
 report.qualityFlags=report.results.filter(x=>x.hasRawToolDraft||x.hasUnprovenTap||x.claimedUnverifiedDeviceExecution||x.retainedLocations===false||x.twoRealSources===false||x.synthesizedResearch===false||x.actualMultiRead===false||x.actualSearchTool===false||x.actualWeatherTool===false||x.actualPublicPageRead===false||!x.complete).map(x=>x.name);
 await mkdir('repository-receipts',{recursive:true});
 await writeFile('repository-receipts/bubbles-signed-chat-acceptance.json',JSON.stringify(report,null,2)+'\n');
 console.log('BUBBLES_CHAT_QA_SUMMARY '+JSON.stringify({completed:report.completed,total:prompts.length,qualityFlags:report.qualityFlags,ownerUiVerified:false,androidVerified:false}));
 if(report.completed!==prompts.length||report.qualityFlags.length)process.exitCode=1;
}
main().catch(e=>{console.error('BUBBLES_CHAT_QA_FATAL '+clean(e.message,200));process.exitCode=1;});
