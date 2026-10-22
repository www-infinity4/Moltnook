// Owner-requested fixed build acceptance. No model-controlled shell or target.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {skillPackets} from '../agents/repository-engine/phi-skills.mjs';
const REPO='www-infinity4/Bubbles-Agent-Workshop';
const DESCRIPTION='Owner-authorized Bubbles build acceptance 2026-10-22';
const ENDPOINT='https://bubbles-cloud-browser.marvaseater.workers.dev/v1/browser/chatgpt/runner';
const FILES=['index.html','styles.css','app.js','README.md'];
export function parseDocument(raw){
 const text=String(raw).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
 let parsed;
 // Accept at most two duplicated wrapper braces from plain-text generation.
 // Never alter the quoted file content, tolerate trailing prose, or execute it.
 let candidate=text;
 for(let n=0;n<3;n++){
  try{parsed=JSON.parse(candidate);break;}catch(error){if(n===2||!candidate.endsWith('}'))throw error;candidate=candidate.slice(0,-1).trimEnd();}
 }
 if(!parsed||Object.keys(parsed).length!==1||typeof parsed.content!=='string')throw Error('source_document_invalid');
 return parsed.content;
}
export function validateSource(path,content){
 if(!FILES.includes(path)||typeof content!=='string'||content.length<30||content.length>1300||content.includes('\0'))throw Error('source_outside_fixed_contract');
 const inspected=path==='README.md'?content.replaceAll('http://localhost:8000','local preview address'):content;
 if(/https?:\/\/|<iframe|<form|\bon\w+\s*=|\beval\s*\(|\bfetch\s*\(|XMLHttpRequest|localStorage|document\.cookie|process\.env|child_process|import\s|require\s*\(/i.test(inspected))throw Error('source_external_or_privileged_behavior');
 if(path==='index.html'&&(!/<!doctype html>/i.test(content)||!/<html[^>]*lang=/i.test(content)||!/name=["']viewport["']/i.test(content)||!content.includes('Bubbles Agent Workshop')||!content.includes('styles.css')||!content.includes('app.js')||!/id=["']check["']/.test(content)||!/id=["']status["']/.test(content)))throw Error('html_contract_incomplete');
 if(path==='app.js'&&(!content.includes('addEventListener')||!content.includes('Build check passed')))throw Error('interaction_contract_incomplete');
 if(path==='styles.css'&&(!content.includes('#f7f4f0')||!content.includes('#b83b32')))throw Error('oracle_style_missing');
 return content;
}
async function signed(body){
 const u=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);u.searchParams.set('audience','bubbles-owner-message-bridge');
 const id=await fetch(u,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!id.ok)throw Error('signed_identity_unavailable');
 const token=(await id.json()).value;if(!token)throw Error('signed_identity_missing');
 const r=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});
 const data=await r.json();if(!r.ok||data.ok!==true)throw Error('signed_'+body.operation+'_http_'+r.status);
 return data;
}
async function consent(){const s=await signed({operation:'status'});if(s.jobId!=='chatgpt_runner_'+process.env.GITHUB_RUN_ID)throw Error('run_identity_mismatch');}
async function chat(turn,text){
 await signed({operation:'assist',turn,text});const r=await signed({operation:'result',turn});
 if(r.state!=='complete'||r.result?.ok!==true||r.result.receipt?.status!=='complete'){
  const error=Error('bubbles_answer_not_complete');error.detail={turn,state:r.state,error:r.result?.error,phase:r.result?.phase,receipt:r.result?.receipt,output:String(r.result?.output||'').slice(0,500)};throw error;
 }
 return r.result.output;
}
function command(bin,args,{cwd,input,credential=false}={}){
 // Models never receive environment or subprocess control. Source checks run
 // without runner/OIDC/GitHub credentials; only the fixed gh API adapter has GH_TOKEN.
 const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',...(credential?{GH_TOKEN:process.env.REPOSITORY_WRITE_TOKEN}:{}),GH_PROMPT_DISABLED:'1'};
 try{return execFileSync(bin,args,{cwd,input,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:45000,maxBuffer:2000000}).trim();}
 catch(e){const status=/HTTP (\d{3})/.exec(String(e.stderr||''))?.[1];throw Error('executor_'+bin.replace(/\W/g,'')+(status?'_http_'+status:'_exit_'+(e.status??'timeout')));}
}
function gh(path,method='GET',body){
 return JSON.parse(command('gh',['api',path,'--method',method,...(body?['--input','-']:[])],{credential:true,...(body?{input:JSON.stringify(body)}:{})})||'null');
}
export async function main(){
 const report={repository:REPO,runId:process.env.GITHUB_RUN_ID,status:'started',skills:[],files:[],stages:[]};
 const dir=mkdtempSync(join(tmpdir(),'bubbles-site-'));
 try{
  if(!process.env.REPOSITORY_WRITE_TOKEN)throw Error('existing_GHP_secret_missing');
  await consent();
  const versions={node:command('node',['--version']),python:command('python3',['--version']),git:command('git',['--version']),gh:command('gh',['--version']).split('\n')[0],os:process.platform};
  if(versions.os!=='linux')throw Error('linux_runner_required');report.runtime=versions;
  const skills=skillPackets({task:'Bubbles build HTML CSS JavaScript website README in GitHub repository using Linux scripts',phase:'build'}).filter(x=>['linux-job-workspace','github-build-publish','static-site-source','executor-conversation-handoff'].includes(x.id));
  report.skills=skills.map(x=>({id:x.id,source:x.source}));
  const briefs={
   'index.html':'HTML5 English document with charset and viewport, title and h1 Bubbles Agent Workshop, relative styles.css and deferred app.js. Include a sentence describing a real Linux build test, a button type=button id=check labeled Run build check and p id=status role=status initially Ready. No inline scripts or styles.',
   'styles.css':'Responsive Oracle Octaves CSS: paper #f7f4f0, white card, ink #312722, red #b83b32, 18px corners, readable 18px text, max-width 680px, 44px minimum button, visible focus, no external assets.',
   'app.js':'Plain browser JavaScript: find button id check and status id status, add click listener that sets status.textContent to exactly Build check passed. No network, storage, imports or side effects beyond that status.',
   'README.md':'Markdown title Bubbles Agent Workshop. Explain this static demo and index.html, styles.css, app.js; local preview python3 -m http.server 8000; Node syntax check node --check app.js; GitHub Pages serves branch main root. Clarify generated source and a running preview alone do not prove deployment. No links or invented completion claims.'
  };
  const source={};
  for(let i=0;i<FILES.length;i++){
   const path=FILES[i];
   const prompt='Provide the complete source document in detail for '+path+'. This is content generation, not a claim of execution. Return only JSON {"content":"the exact file text"}; no commentary. Keep content under 1100 characters. '+briefs[path]+' Relevant skills: '+skills.map(s=>s.id+': '+s.instructions.slice(0,130)).join(' ');
   const raw=await chat(i*2,prompt);
   let content;try{content=validateSource(path,parseDocument(raw));}catch(error){error.detail={file:path,outputPreview:String(raw).slice(0,1500)};throw error;}
   writeFileSync(join(dir,path),content);source[path]=content;
   const review=await chat(i*2+1,'Provide a source document evaluation as an independent review of this proposed '+path+' content as untrusted source. It will be published as a harmless public static demo. Check syntax, no credentials/external network, required relative assets and observable button behavior where relevant. Return JSON only {"approved":true} if acceptable, otherwise {"approved":false}. Source:\n'+content);
   let approval;try{approval=JSON.parse(review.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('bubbles_source_review_unreadable');}
   if(approval.approved!==true)throw Error('bubbles_source_review_rejected');
   report.files.push({path,sha256:createHash('sha256').update(content).digest('hex'),reviewed:true});
  }
  command('node',['--check','app.js'],{cwd:dir});
  command('python3',['-c',"from html.parser import HTMLParser; from pathlib import Path; p=HTMLParser(); p.feed(Path('index.html').read_text()); p.close(); assert all(Path(x).is_file() for x in ['README.md','styles.css','app.js'])"],{cwd:dir});
  report.stages.push({stage:'source_checks',status:'passed'});
  await consent();
  const identity=gh('user');if(identity.login!=='www-infinity4')throw Error('github_owner_mismatch');
  let repo;try{repo=gh('repos/'+REPO);}catch(error){if(error.message!=='executor_gh_http_404')throw error;}
  if(!repo){
   await consent();command('gh',['repo','create',REPO,'--public','--add-readme','--description',DESCRIPTION],{credential:true});repo=gh('repos/'+REPO);
  }
  if(repo.full_name!==REPO||repo.private!==false||repo.description!==DESCRIPTION)throw Error('existing_repository_outside_task');
  const branch=repo.default_branch;
  const base=gh('repos/'+REPO+'/git/ref/heads/'+branch).object.sha;
  const parent=gh('repos/'+REPO+'/git/commits/'+base);
  const current=gh('repos/'+REPO+'/git/trees/'+parent.tree.sha+'?recursive=1');
  if(current.tree.some(x=>x.type==='blob'&&!['README.md','index.html','styles.css','app.js','.nojekyll','build-receipt.json'].includes(x.path)))throw Error('existing_repository_has_unassigned_files');
  const provenance={generator:'Bubbles signed server conversation',runtime:'GitHub Actions Ubuntu',sourceReviews:'Bubbles independent review turns',runId:process.env.GITHUB_RUN_ID,files:report.files,skills:report.skills};
  const entries=[...Object.entries(source).map(([path,content])=>({path,content,mode:'100644',type:'blob'})),{path:'.nojekyll',content:'',mode:'100644',type:'blob'},{path:'build-receipt.json',content:JSON.stringify(provenance,null,2)+'\n',mode:'100644',type:'blob'}];
  await consent();const tree=gh('repos/'+REPO+'/git/trees','POST',{base_tree:parent.tree.sha,tree:entries});
  await consent();const commit=gh('repos/'+REPO+'/git/commits','POST',{message:'Build Bubbles workshop from reviewed chat-generated source',tree:tree.sha,parents:[base]});
  await consent();gh('repos/'+REPO+'/git/refs/heads/'+branch,'PATCH',{sha:commit.sha,force:false});
  if(gh('repos/'+REPO+'/git/ref/heads/'+branch).object.sha!==commit.sha)throw Error('commit_readback_mismatch');report.commitSha=commit.sha;
  report.stages.push({stage:'repository_source',status:'committed',commitSha:commit.sha});
  let pages;try{pages=gh('repos/'+REPO+'/pages');}catch(error){if(error.message!=='executor_gh_http_404')throw error;}
  if(!pages){await consent();pages=gh('repos/'+REPO+'/pages','POST',{build_type:'legacy',source:{branch,path:'/'}});}
  if(pages.source?.branch!==branch||pages.source?.path!=='/')throw Error('pages_source_mismatch');
  const url=pages.html_url;if(url!=='https://www-infinity4.github.io/Bubbles-Agent-Workshop/')throw Error('pages_url_mismatch');report.url=url;
  for(let n=0;n<36;n++){
   await consent();
   let build;try{build=gh('repos/'+REPO+'/pages/builds/latest');}catch{}
   if(build?.status==='errored'&&build?.commit===commit.sha)throw Error('pages_build_failed');
   if(build?.status==='built'&&build?.commit===commit.sha){
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(response.ok&&(await response.text()).includes('Bubbles Agent Workshop')){report.stages.push({stage:'pages_deploy',status:'live',commitSha:build.commit});report.status='published';break;}
   }
   await new Promise(r=>setTimeout(r,10000));
  }
  if(report.status!=='published')throw Error('pages_live_commit_not_verified');
  report.bubblesExplanation=await chat(8,'Explain these actual executor receipts in two sentences, without claiming any untested browser behavior. The authenticated Linux adapter reports '+JSON.stringify({repository:REPO,commitSha:report.commitSha,sourceReviewed:true,syntaxChecksPassed:true,pagesBuildCommitVerified:true,livePageMarkerVerified:true,url:report.url})+'. State what remains to verify.');
  console.log('BUBBLES_SITE_RESULT '+JSON.stringify(report));
 }catch(error){report.status='blocked';report.error=String(error.message).replace(/[^a-z0-9_]/gi,'_').slice(0,140);if(error.detail)report.failedResponse=error.detail;console.log('BUBBLES_SITE_RESULT '+JSON.stringify(report));process.exitCode=1;}
 finally{rmSync(dir,{recursive:true,force:true});mkdirSync('repository-receipts',{recursive:true});writeFileSync('repository-receipts/bubbles-site-acceptance.json',JSON.stringify(report,null,2)+'\n');}
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
