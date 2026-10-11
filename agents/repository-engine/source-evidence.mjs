// Bounded, read-only source context for the AI reader before it declares a job blocked.
// Never send credentials, generated bundles, or uncontrolled repository paths to a model.
const SKIP=/(^|\/)(?:\.git|\.github|node_modules|vendor|dist|build|coverage|\.next|__pycache__|secrets?|credentials?)(\/|$)|(?:^|\/)(?:\.env[^/]*|[^/]*\.min\.(?:js|css)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const ALLOWED=/\.(?:html?|mjs|cjs|jsx?|tsx?|css|json|md|py)$/i;
const SENSITIVE=/(?:BEGIN [A-Z ]*PRIVATE KEY|authorization\s*[:=]|(?:api[_-]?key|secret|password|private[_-]?key)\s*[:=]|bearer\s+\S+)/i;
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
  const lines=source.split(/\r?\n/),hits=[];
  for(let i=0;i<lines.length;i++){
   const line=lines[i].toLowerCase();
   if(terms.some(t=>line.includes(t))||/href\s*=|https?:\/\/|fetch\s*\(|location\.href/i.test(line))hits.push(i);
   if(hits.length>=32)break;
  }
  const chosen=new Set();
  for(let i=0;i<Math.min(lines.length,8);i++)chosen.add(i);
  for(const i of hits){for(let j=Math.max(0,i-1);j<=Math.min(lines.length-1,i+1);j++)chosen.add(j)}
  const snippets=[...chosen].sort((a,b)=>a-b).map(i=>String(i+1)+': '+(SENSITIVE.test(lines[i])?'[credential-bearing line omitted]':lines[i].slice(0,350)));
  const excerpt=snippets.join('\n').slice(0,Math.min(3200,remaining));
  if(excerpt){result[file]=excerpt;remaining-=excerpt.length}
 }
 return result;
}
