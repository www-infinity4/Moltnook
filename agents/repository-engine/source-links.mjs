// Read-only, bounded extraction of existing HTML link labels and destinations.
// These are repository facts, not a claim that the URL responds on the live site.
const HTML=/\.html?$/i;
const OMIT=new Set(['please','button','broken','about','where','should','current','actual','there','inside','quantaphi','which','links','needs','fixed','repair']);
const strip=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const attr=(s,name)=>{const m=s.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));return m?(m[1]||m[2]||m[3]||'').slice(0,350):''};
export async function collectLinkFacts({paths,task='',read,maxLinks=6}={}){
 if(!Array.isArray(paths)||typeof read!=='function')throw new TypeError('Source paths and reader required');
 const terms=[...new Set((String(task).toLowerCase().match(/[a-z][a-z0-9_-]{4,}/g)||[]).filter(x=>!OMIT.has(x)))].slice(0,12);
 if(!terms.length)return [];
 const files=paths.filter(p=>typeof p==='string'&&p.length<180&&HTML.test(p)&&!p.includes('..')&&!p.startsWith('/')&&!p.includes('\\')&&!/(^|\/)(\.github|\.git|vendor|dist|node_modules)\//.test(p)).sort((a,b)=>(a==='index.html'?-1:0)-(b==='index.html'?-1:0)).slice(0,3);
 const found=[];
 for(const file of files){
  let html;try{html=await read(file)}catch{continue}
  if(typeof html!=='string'||html.length>1200000)continue;
  const anchors=html.matchAll(/<a\b([^>]{0,1500})>([\s\S]*?)<\/a>/gi);
  for(const m of anchors){
   const id=attr(m[1],'id'),href=attr(m[1],'href'),siteUrl=attr(m[1],'data-site-url');
   const label=strip(m[2]).slice(0,140),ariaLabel=attr(m[1],'aria-label').slice(0,140);
   const combined=(id+' '+href+' '+siteUrl+' '+label+' '+ariaLabel).toLowerCase();
   const matches=terms.filter(t=>combined.includes(t)).length;
   if(!matches||!/^\/|^https:\/\//i.test(href)||/(?:javascript|data):/i.test(href))continue;
   found.push({sourcePath:file,id,label,ariaLabel,href,siteUrl,matchingTerms:matches});
   if(found.length>80)break;
  }
 }
 return found.sort((a,b)=>b.matchingTerms-a.matchingTerms||a.sourcePath.localeCompare(b.sourcePath)).slice(0,Math.min(10,Math.max(1,maxLinks)));
}
