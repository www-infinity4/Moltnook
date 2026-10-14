// Owner-wide Oracle Octaves visual and development audit; issues are proposals, not edits.
// Scan every accessible owner repository (paginated) using pinned GitHub source evidence.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const OWNER='www-infinity4',TRACKER=OWNER+'/Oracle-Octaves';
const token=process.env.REPOSITORY_WRITE_TOKEN||'';
const headers={authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'};
export const ORACLE={paper:'#f7f4f0',surface:'#fff',ink:'#312722',line:'#e5ddd6',red:'#b83b32',gold:'#d6a34a',radius:'18px'};
const STYLE=/\.(css|scss)$/i,UI=/(^|\/)(index\.html|page\.tsx|app\.tsx|globals\.css|styles\.css|style\.css|site-theme\.css|oracle-interface\.css)$/i;
export function reviewRepositoryTree(repo,tree,samples={}){
 if(!repo||repo.archived||repo.disabled)return null;
 if(!Array.isArray(tree)||!tree.length)return null;
 const paths=tree.filter(x=>x.type==='blob').map(x=>x.path);
 const ui=paths.filter(x=>UI.test(x)).slice(0,24);
 if(!ui.length)return null; // Libraries and non-website projects are not redesign candidates.
 const css=paths.filter(x=>STYLE.test(x)).slice(0,15);
 const candidates=Object.entries(samples).filter(([p])=>ui.includes(p)||css.includes(p)).map(([,v])=>v);
 const composite=candidates.join('\n').slice(0,90000);
 const oraclePresent=/(oracle-(card|surface|action|quanta|octaves|interface)|--oracle-|#f7f4f0|#b83b32)/i.test(composite);
 const darkLegacy=/(color-scheme\s*:\s*dark|background(?:-color)?\s*:\s*#(?:000|111|080808)\b|background\s*:\s*linear-gradient\([^;]*#0[0-9a-f]{5})/i.test(composite);
 const hasTests=paths.some(x=>/(^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]s$/.test(x));
 const hasCI=paths.some(x=>x.startsWith('.github/workflows/')&&/\.ya?ml$/.test(x));
 const concerns=[];
 if(!oraclePresent)concerns.push('No Oracle Octaves design contract identified in sampled UI source');
 if(darkLegacy)concerns.push('Legacy dark surface declarations need human-visible before/after comparison');
 if(!hasTests)concerns.push('No tracked test suite detected; add scoped accessibility/smoke checks before changing UI');
 if(!hasCI)concerns.push('No GitHub Actions workflow detected for build/test verification');
 if(!concerns.length)return null;
 return {name:repo.full_name,sha:repo.headSha||null,uiPaths:ui,stylePaths:css,hasTests,hasCI,oraclePresent,darkLegacy,concerns,
  recommendation:'Reuse canonical Oracle Octaves white daylight cards, colored card identities, warm ink, soft borders, red rounded actions, 44px controls, wallet and existing StarQuest controls unchanged.'};
}
async function gh(path,options={}){
 const res=await fetch('https://api.github.com/'+path,{method:options.method||'GET',
  headers:{...headers,...(options.body?{'content-type':'application/json'}:{})},
  ...(options.body?{body:JSON.stringify(options.body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error('GitHub '+res.status+' at '+path.split('?')[0]);
 return res.json();
}
async function readSource(repo,path,ref){
 const url='repos/'+repo+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(ref);
 try{const data=await gh(url);if(data.type!=='file'||data.size>100000||data.encoding!=='base64')return '';
  return Buffer.from(data.content.replace(/\s/g,''),'base64').toString('utf8');
 }catch{return '';}
}
export async function collectInventory({maxRepos=2000}={}){
 if(!token)throw Error('Owner read/write credential missing');
 const repos=[];
 for(let page=1;page<=20&&repos.length<maxRepos;page++){
  const batch=await gh('user/repos?affiliation=owner&per_page=100&page='+page);
  repos.push(...batch.filter(r=>r.owner?.login===OWNER&&!r.archived&&!r.disabled));
  if(batch.length<100)break;
 }
 const evidence=[],failures=[];
 for(const repo of repos.slice(0,maxRepos)){
  try{
   const sha=repo.default_branch;
   const data=await gh('repos/'+repo.full_name+'/git/trees/'+encodeURIComponent(sha)+'?recursive=1');
   if(data.truncated){failures.push({repository:repo.full_name,error:'tree_truncated'});continue;}
   const paths=(data.tree||[]).map(x=>x.path);
   const picks=[...new Set([...paths.filter(x=>UI.test(x)&&x.length<150),...paths.filter(x=>STYLE.test(x)&&x.length<150)])].slice(0,8);
   if(!picks.length)continue;
   const samples={};
   for(const path of picks)samples[path]=await readSource(repo.full_name,path,sha);
   const record=reviewRepositoryTree({...repo,headSha:data.sha},data.tree,samples);
   if(record)evidence.push(record);
  }catch(error){failures.push({repository:repo.full_name,error:String(error.message).slice(0,180)})}
 }
 return {scannedAt:new Date().toISOString(),owner:OWNER,foundRepositories:repos.length,scannedRepositories:Math.min(repos.length,maxRepos),
  source:'authenticated owner repository trees, GitHub default-branch source; no deployment claim',oraclePolicy:ORACLE,evidence,failures};
}
export function ticketFromFinding(finding){
 const suffix=finding.name.split('/')[1];
 return {title:'[Agent Job] Oracle Octaves visual + development audit: '+suffix,
 body:[
  'Source-based design/engineering work request. It is not a completed repair.',
  '',
  'Repository: '+finding.name,
  'Inspected source SHA: '+(finding.sha||'unavailable'),
  'Source: https://github.com/'+finding.name+'/tree/'+(finding.sha||'main'),
  '',
  'Specific gaps:',
  ...finding.concerns.map(x=>'- '+x),
  '',
  'UI files observed: '+finding.uiPaths.join(', '),
  'Sampled style files: '+(finding.stylePaths.slice(0,10).join(', ')||'none'),
  '',
  'DESIGN SYSTEM: Oracle Octaves is the canonical style reference for every user-facing Infinity site. Source: https://github.com/www-infinity4/Oracle-Octaves/blob/main/index.html and https://github.com/www-infinity4/QuantaPhi/blob/main/oracle-interface.css',
  'Use white cards (#fff), daylight paper (#f7f4f0), warm ink (#312722), understated borders (#e5ddd6), rounded 18px cards, red #b83b32 actions, clear text, accessible keyboard focus, 44px buttons, responsive mobile layouts. Retain the existing meaning of orange/purple/blue/yellow/green cards and all live players, image generators, StarQuest star/share/collect, wallet and mint/receipt rules.',
  '',
  'IMPLEMENT: isolate a clone at this SHA; preview mobile+desktop; improve only the actual relevant visual components; add tests/contrast checks; Pink code+browser reviewer and GPT Purple must inspect exact changed SHA; stage robot/* PR; merge only after independent target CI, model review, and GitHub branch rules. Do not replace functional markup or override host authentication.',
  '',
  'Idea discovery: if no tests, provide an actionable smoke test; if no CI, propose an acceptance workflow in a separate, explicitly reviewed security-sensitive PR.',
  'Verification needed: exact diff, passing tests, before/after screenshots and live route acceptance. No synthetic activity receipts.'
 ].join('\n')};
}
async function publishFindings(inventory){
 const existing=new Set();
 for(let page=1;page<=10;page++){
  const rows=await gh('repos/'+TRACKER+'/issues?state=all&per_page=100&page='+page);
  for(const row of rows)if(row.title&&!row.pull_request)existing.add(row.title);
  if(rows.length<100)break;
 }
 const created=[];
 for(const item of inventory.evidence){
  if(created.length>=5)break;
  const t=ticketFromFinding(item);
  if(existing.has(t.title))continue;
  const issue=await gh('repos/'+TRACKER+'/issues',{method:'POST',body:t});
  if(!issue.html_url||!issue.number)throw Error('New design ticket has no GitHub receipt');
  created.push({repository:item.name,url:issue.html_url,number:issue.number});
  existing.add(t.title);
 }
 return created;
}
export async function run(){
 const inventory=await collectInventory();
 inventory.issuesCreated=await publishFindings(inventory);
 await fs.mkdir('repository-receipts',{recursive:true});
 await fs.writeFile('repository-receipts/oracle-owner-inventory.json',JSON.stringify(inventory,null,2));
 console.log(JSON.stringify({repositories:inventory.scannedRepositories,designGaps:inventory.evidence.length,errors:inventory.failures.length,issuesCreated:inventory.issuesCreated}));
 return inventory;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)try{await run()}catch(e){
 await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/oracle-owner-inventory.json',JSON.stringify({error:String(e.message),at:new Date().toISOString()},null,2));console.error(e.message);process.exitCode=1;
}
