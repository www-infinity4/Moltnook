// Bounded, read-only source context for the AI reader before it declares a job blocked.
// Never send credentials, generated bundles, or uncontrolled repository paths to a model.
const SKIP=/(^|\/)(?:\.git|\.github|node_modules|vendor|dist|build|coverage|\.next|__pycache__|secrets?|credentials?)(\/|$)|(?:^|\/)(?:\.env[^/]*|[^/]*\.min\.(?:js|css)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const ALLOWED=/\.(?:html?|mjs|cjs|jsx?|tsx?|css|json|md|py)$/i;
const SENSITIVE=/(?:BEGIN [A-Z ]*PRIVATE KEY|authorization\s*[:=]|(?:api[_-]?key|secret|password|private[_-]?key)\s*[:=]|bearer\s+\S+)/i;
const GENERIC=new Set(['fix','broken','button','link','section','application','identify','replace','owner','correct','exact','destination','requested','text','label','code','repo','source']);
const OMIT=new Set(['please','could','would','should','about','there','their','these','those','with','from','this','that','into','your','they','when','what','have','site','page','work','task','build','make','need','look','code']);
export async function collectSourceEvidence({paths,task='',read,maxChars=16000}={}){
 if(!Array.isArray(paths)||typeof read!=='function')throw new TypeError('Paths and source reader required');
 const terms=[...new Set(String(task).toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g)||[])].filter(w=>!OMIT.has(w)).slice(0,35);
 const candidates=paths.filter(p=>typeof p==='string'&&p.length<200&&!SKIP.test(p)&&ALLOWED.test(p)&&!p.startsWith('/')&&!p.includes('..')&&!p.includes('\\'))
  .map(p=>({path:p,score:(/(^|\/)index\.html?$/i.test(p)?5:0)+(terms.reduce((n,t)=>n+(p.toLowerCase().includes(t)?4:0),0))+(p.toLowerCase().includes('src/')?1:0)}))
  .sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,9);
 const result={};let remaining=Math.min(20000,Math.max(1000,Number(maxChars)||16000));
 for(const {path:file} of candidates){
  if(remaining<500)break;
  let source;try{source=await read(file)}catch{continue}
  if(typeof source!=='string'||!source.trim())continue;
  const lines=source.split(/\r?\n/),ranked=[],specific=terms.filter(t=>!GENERIC.has(t));
  // Prefer the owner's actual named subject and existing clickable URLs over
  // generic early-page "link" or "button" text. Do not skip the whole file.
  for(let i=0;i<lines.length;i++){
   const line=lines[i].toLowerCase();
   const exact=specific.filter(t=>line.includes(t)).length;
   const other=terms.filter(t=>GENERIC.has(t)&&line.includes(t)).length;
   const destination=/<a\b|href\s*=|data-site-url/i.test(line)?8:0;
   if(exact||other||destination)ranked.push({i,score:exact*12+Math.min(other,3)+destination});
  }
  ranked.sort((a,b)=>b.score-a.score||a.i-b.i);
  const chosen=new Set();
  for(const {i} of ranked.slice(0,10)){
   chosen.add(i);
   if(i>0)chosen.add(i-1);
   if(i+1<lines.length)chosen.add(i+1);
  }
  for(let i=0;i<Math.min(lines.length,3);i++)chosen.add(i);
  const snippets=[...chosen].map(i=>String(i+1)+': '+(SENSITIVE.test(lines[i])?'[credential-bearing line omitted]':lines[i].slice(0,500)));
  const excerpt=snippets.join('\n').slice(0,Math.min(3200,remaining));
  if(excerpt){result[file]=excerpt;remaining-=excerpt.length}
 }
 return result;
}
