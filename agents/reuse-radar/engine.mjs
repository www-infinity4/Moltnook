// Oracle Reuse Radar. Deterministic evidence screening before LLM review.
export const REPOS=['www-infinity4/QuantaPhi','www-infinity4/Omni-Phi','www-infinity4/News-Phi','www-infinity4/TV-Database','www-infinity4/ShopLC','www-infinity4/C13b0','www-infinity4/Web-Phi','www-infinity4/Moltnook'];
export const REGIONS={
 'www-infinity4/QuantaPhi':'orange story cards, image picker, learning pages',
 'www-infinity4/Omni-Phi':'image search, AI overview, site generation',
 'www-infinity4/News-Phi':'news image cards, embedded article reader',
 'www-infinity4/TV-Database':'TV playback, channel cards, StarQuest',
 'www-infinity4/ShopLC':'product viewer, buy controls and reward receipts',
 'www-infinity4/C13b0':'Infinity mobile website builder',
 'www-infinity4/Web-Phi':'website preview and page publishing',
 'www-infinity4/Moltnook':'robot observers, patch review and agent routing'
};
const RULES={upload:/upload|dropzone|type=.file|readAsDataURL|image.?picker/i,button:/<button|createElement\(['"]button|aria-controls|click/i,image:/<img|thumbnail|object-fit|illustrat/i,viewer:/iframe|viewer|postMessage|embed/i,media:/audio|video|player|stream/i,card:/card|story|article|news/i,builder:/website|builder|template|generate.?page/i,observer:/watcher|observer|test|health.?check/i,search:/search|overview|indexer/i};
const DISALLOWED=/^\.github\/|(^|\/)(?:node_modules|dist|build|coverage)\/|\.min\.js$|\.(?:png|webp|jpe?g|svg|gif|mp4|map)$/i;
export function describeChange(file){
 const p=String(file.filename||'');
 if(!p||p.length>180||DISALLOWED.test(p)||file.status==='removed'||!/\.(?:js|mjs|ts|tsx|jsx|html|css)$/.test(p))return null;
 const lines=String(file.patch||'').split('\n').filter(s=>s.startsWith('+')&&!s.startsWith('+++')).map(s=>s.slice(1)).join('\n').slice(0,2800);
 if(lines.length<40)return null;
 const kinds=Object.entries(RULES).filter(([,rx])=>rx.test(p)||rx.test(lines)).map(([kind])=>kind);
 return kinds.length?{path:p,kinds:kinds.slice(0,4),added:Math.max(0,Number(file.additions)||0),evidence:lines.slice(0,1100)}:null;
}
export function candidates(repo,feature){
 return REPOS.filter(r=>r!==repo).map(r=>({repo:r,region:REGIONS[r],score:feature.kinds.reduce((n,k)=>n+(REGIONS[r].toLowerCase().includes(k)?2:1),0)})).sort((a,b)=>b.score-a.score||a.repo.localeCompare(b.repo)).slice(0,4);
}
export function acceptReview(result,source,sha,feature,targets){
 if(!result||result.decision!=='reuse'||!targets.some(t=>t.repo===result.targetRepo)||Number(result.confidence)<0.7||Number(result.confidence)>1)return null;
 const summary=String(result.summary||'').slice(0,260),reason=String(result.reason||'').slice(0,400),adaptation=String(result.adaptation||'').slice(0,450);
 if(summary.length<12||reason.length<15||adaptation.length<15)return null;
 return {source,sha,path:feature.path,target:result.targetRepo,kinds:feature.kinds,confidence:Number(result.confidence),summary,reason,adaptation};
}
export function issueBody(r){
 return ['<!-- oracle-reuse-v1:'+r.sha+':'+r.target+':'+r.path+' -->',
  '## Oracle LLM cross-repository reuse proposal',
  '**Existing source:** https://github.com/'+r.source+'/blob/'+r.sha+'/'+r.path,
  '**Target repository:** '+r.target+' — '+REGIONS[r.target],
  '**Feature:** '+r.kinds.join(', '),'**Model confidence (not verified):** '+r.confidence.toFixed(2),
  '**Reuse suggestion:** '+r.summary,'**Reason:** '+r.reason,'**Adaptation:** '+r.adaptation,
  'Blue agents check data and boundaries; Green inspects the destination; Pink proposes a patch; Purple validates tests and browser behavior.',
  'This suggestion grants no repo access, copies no files, changes no wallets, and creates no payout. A reviewed tested commit is required for credits.'
 ].join('\n\n');
}
