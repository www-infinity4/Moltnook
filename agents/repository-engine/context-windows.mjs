// Immutable, size-limited model windows. The runner retains each FULL source and
// applies the model's literal before/after edits only after exact-source checks.
// Source windows are evidence, never authority to change unshown parts of files.
import {createHash} from 'node:crypto';
export const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
const WORD=/[a-z][a-z0-9_-]{3,}/gi;
const STOP=new Set('that this from with have will into when where which should could everything project existing repository files source page build code bot agent make change work layout update something requested current about outside main work current fix create ensure checks original'.split(' '));
function words(v){return [...new Set(String(v||'').match(WORD)||[])].map(x=>x.toLowerCase()).filter(x=>!STOP.has(x)).slice(0,65);}
export function sourceWindows(original,{task='',plan={},maxChars=32000}={}){
 if(!original||typeof original!=='object'||maxChars<4000)throw Error('bounded_source_required');
 const paths=Object.keys(original);
 if(paths.length>12)throw Error('source_window_file_limit');
 const hints=words([task,plan.summary,...(plan.requirements||[]),...(plan.acceptance||[])].join(' '));
 let budget=maxChars;const packet={};
 for(const path of paths){
  const full=original[path];
  if(full===null){packet[path]={kind:'new',totalChars:0,sha256:null,windows:[]};continue;}
  if(typeof full!=='string')throw Error('source_window_invalid_file');
  const fileBudget=Math.min(7000,Math.max(1800,Math.floor(budget/Math.max(1,paths.length-Object.keys(packet).length))));
  if(fileBudget<1500)throw Error('source_window_budget_exhausted');
  const terms=[...new Set([...words(path.replace(/[/.]/g,' ')),...hints])];
  const candidates=[];
  for(const term of terms){
   let pos=-1,found=0;
   while(found<4&&(pos=full.toLowerCase().indexOf(term,pos+1))>=0){
    candidates.push({pos,score:term.length+(hints.includes(term)?9:0)});found++;
   }
  }
  candidates.sort((a,b)=>b.score-a.score||a.pos-b.pos);
  // Prefer up to fifteen complete lines before and after each anchor. A minified
  // megabyte-sized line falls back to a strict character budget.
  const makeWindow=pos=>{
   const cap=Math.floor(fileBudget/2),half=Math.floor(cap/2);
   let start=pos,end=pos,lines=0;
   while(start>0&&pos-start<half&&lines<15){
    const prev=full.lastIndexOf('\n',start-2);
    const next=prev<0?0:prev+1;
    if(next===start)break;start=next;lines++;
   }
   lines=0;
   while(end<full.length&&end-start<cap&&lines<15){
    const next=full.indexOf('\n',end);
    end=next<0?full.length:next+1;lines++;
   }
   if(end-start>cap||start===end){start=Math.max(0,pos-half);end=Math.min(full.length,start+cap);}
   return {start,end};
  };
  const take=[];
  if(full.length<=fileBudget)take.push({start:0,end:full.length});
  else{
   // Multiple hints often hit one element. Search past overlapping anchors so
   // the second window exposes another relevant source region, not a duplicate.
   for(const candidate of candidates){
    const range=makeWindow(candidate.pos);
    if(take.some(w=>range.start<w.end&&range.end>w.start))continue;
    take.push(range);if(take.length===2)break;
   }
   if(!take.length)take.push({start:0,end:Math.min(fileBudget,full.length)});
  }
  const windows=[];for(const range of take){
   const start=range.start,end=range.end,part=full.slice(start,end);
   if(!part||windows.some(w=>start>=w.start&&end<=w.end))continue;
   windows.push({start,end,text:part,sha256:sha256(part)});
  }
  const used=windows.reduce((n,w)=>n+w.text.length,0);
  if(used>fileBudget+150||used>budget)throw Error('source_window_over_budget');
  budget-=used;
  packet[path]={kind:'existing',totalChars:full.length,sha256:sha256(full),
   complete:used===full.length&&windows.length===1,windows};
 }
 return {schemaVersion:1,source:packet,maximumChars:maxChars,remainingChars:budget,
  note:'Only shown immutable windows may be edited. Full source is retained privately by the authenticated checkout.'};
}
export function checkVisibleEdits(packet,edits){
 if(!packet?.source||!Array.isArray(edits)||!edits.length)return false;
 for(const e of edits){
  if(!e||typeof e.path!=='string'||typeof e.after!=='string')return false;
  const item=packet.source[e.path];
  if(!item)return false;
  if(e.before===null){if(item.kind!=='new'||e.after.length>15000)return false;continue;}
  if(item.kind!=='existing'||typeof e.before!=='string'||!e.before)return false;
  if(!item.windows.some(w=>w.text.includes(e.before)))return false;
 }
 return true;
}
// Return schema facts only, never source text, so a bounded retry can repair
// its representation without weakening the immutable-window gate.
export function visibleEditFeedback(packet,edits){
 if(!Array.isArray(edits)||!edits.length)return 'Expected a nonempty edits array. Select one allowed path and copy an exact before substring from a shown immutable source window, with after containing the real replacement. For an approved new file use before:null. Empty edits cannot satisfy a build ticket; preserve genuine blockers instead of inventing a change.';
 return edits.map((e,i)=>{
  const item=packet?.source?.[e?.path];
  if(!item)return 'Edit '+i+': path is not in the reader plan.';
  if(typeof e.after!=='string')return 'Edit '+i+': after must be full string content.';
  if(item.kind==='new')return 'Edit '+i+': new file requires before:null (JSON null, not empty string or a source object), full after content, maximum 15000 characters; received before type '+(e.before===null?'null':typeof e.before)+', after length '+e.after.length+'.';
  return 'Edit '+i+': existing file requires a nonempty before string copied exactly from one shown source window; received before type '+typeof e.before+'.';
 }).slice(0,12).join(' ');
}
export function patchDigests(patched){
 const hashes={};
 for(const [path,content]of Object.entries(patched||{})){
  if(typeof content!=='string'||!path)throw Error('patched_content_missing');
  hashes[path]=sha256(content);
 }
 if(!Object.keys(hashes).length)throw Error('no_patched_content');
 return hashes;
}
export function boundedPatched(patched,{maxChars=18000}={}){
 const output={};let budget=maxChars;
 for(const [path,content]of Object.entries(patched)){
  if(content.length<=Math.min(8000,budget)){output[path]=content;budget-=content.length;}
 }
 return output;
}


// One bounded, deterministic source-context replan after a failed Green build.
// This is a REPLACEMENT of view windows, never permission to edit unseen source.
// The verified checkout stays pinned to its original blob digest and file list.
export function recalculateBounds(original,packet,{
 attempt=1,expansionRatio=1.5,baseline=packet,task='',plan={},rejectedEdits=[]
}={}){
 if(!Number.isInteger(attempt)||attempt<1||attempt>2)throw Error('source_replan_attempt_invalid');
 if(!Number.isFinite(expansionRatio)||expansionRatio<1||expansionRatio>1.5)
  throw Error('source_window_expansion_limit');
 if(!packet?.source||!baseline?.source||!Number.isInteger(packet.maximumChars)||
    packet.maximumChars<4000||packet.maximumChars>32000||
    baseline.maximumChars!==packet.maximumChars)throw Error('source_replan_packet_invalid');
 const paths=Object.keys(original||{});
 if(paths.length>12||paths.length!==Object.keys(packet.source).length||
    paths.length!==Object.keys(baseline.source).length||
    paths.some(p=>!Object.hasOwn(packet.source,p)||!Object.hasOwn(baseline.source,p)))
  throw Error('source_replan_scope_changed');
 const usage=x=>x.windows.reduce((n,w)=>n+w.text.length,0);
 const verify=(item,full)=>{
  if(full===null)return item.kind==='new'&&item.sha256===null&&item.windows.length===0;
  if(typeof full!=='string'||item.kind!=='existing'||item.sha256!==sha256(full)||
     item.totalChars!==full.length||!Array.isArray(item.windows))return false;
  return item.windows.every(w=>Number.isInteger(w.start)&&Number.isInteger(w.end)&&
   w.start>=0&&w.end<=full.length&&w.end>w.start&&
   w.text===full.slice(w.start,w.end)&&w.sha256===sha256(w.text));
 };
 for(const path of paths)if(!verify(packet.source[path],original[path])||
  !verify(baseline.source[path],original[path]))throw Error('source_replan_snapshot_mismatch');
 const total=Object.values(packet.source).reduce((n,item)=>n+usage(item),0);
 if(total>packet.maximumChars)throw Error('source_replan_budget_invalid');
 let slack=packet.maximumChars-total,changed=false;
 const result={...packet.source};
 const terms=words([task,plan.summary,...(plan.requirements||[]),...(plan.acceptance||[])].join(' '));
 for(const path of paths){
  const full=original[path],prior=packet.source[path],initial=baseline.source[path];
  if(full===null||prior.complete||prior.windows.length===0)continue;
  const oldUsed=usage(prior),baseUsed=usage(initial);
  const limit=Math.min(7000,Math.floor(baseUsed*expansionRatio),oldUsed+slack);
  if(limit<256)continue;
  const inPrior=p=>prior.windows.some(w=>p>=w.start&&p<w.end);
  let focus=-1;
  // A rejected exact before literal may locate a different window, but it
  // must match the actual pinned file uniquely. No supplied coordinates.
  for(const e of Array.isArray(rejectedEdits)?rejectedEdits:[]){
   if(e?.path!==path||typeof e.before!=='string'||!e.before||e.before.length>4000)continue;
   const at=full.indexOf(e.before);
   if(at>=0&&full.indexOf(e.before,at+1)<0&&!inPrior(at)){focus=at;break;}
  }
  // Empty edits: choose a previously unseen task-related source location.
  if(focus<0){
   const matches=[];
   for(const term of [...words(path.replace(/[/.]/g,' ')),...terms]){
    let at=-1,seen=0;
    while(seen<8&&(at=full.toLowerCase().indexOf(term,at+1))!==-1){
     if(!inPrior(at))matches.push({at,rank:term.length+(terms.includes(term)?8:0)});
     seen++;
    }
   }
   matches.sort((a,b)=>b.rank-a.rank||a.at-b.at);
   if(matches.length)focus=matches[Math.min(attempt-1,matches.length-1)].at;
  }
  const primary=prior.windows[Math.min(attempt-1,prior.windows.length-1)];
  if(focus<0)focus=attempt===1?primary.end:Math.max(0,primary.start-1);
  if(focus<0||focus>=full.length)continue;
  const keepLength=Math.min(primary.text.length,Math.max(128,Math.floor(limit/2)));
  const keepStart=primary.start+Math.floor((primary.text.length-keepLength)/2);
  const keep={start:keepStart,end:keepStart+keepLength};
  const width=Math.min(limit-keepLength,full.length-keepLength);
  if(width<64)continue;
  let start=Math.max(0,Math.min(full.length-width,focus-Math.floor(width/2)));
  let end=start+width;
  if(start<keep.end&&end>keep.start){
   if(keep.end+width<=full.length){start=keep.end;end=start+width;}
   else if(keep.start>=width){end=keep.start;start=end-width;}
   else continue;
  }
  const pieces=[keep,{start,end}].sort((a,b)=>a.start-b.start);
  const windows=pieces.map(w=>({...w,text:full.slice(w.start,w.end),
   sha256:sha256(full.slice(w.start,w.end))}));
  const nextUsed=usage({windows});
  if(nextUsed>limit||nextUsed>7000||nextUsed-oldUsed>slack||
     windows.some((w,i)=>i>0&&w.start<windows[i-1].end))throw Error('source_replan_budget_violation');
  const different=JSON.stringify(windows.map(w=>[w.start,w.end]))!==
    JSON.stringify(prior.windows.map(w=>[w.start,w.end]));
  if(!different)continue;
  slack-=nextUsed-oldUsed;changed=true;
  result[path]={...prior,windows,complete:nextUsed===full.length&&windows.length===1};
 }
 return {...packet,source:result,remainingChars:packet.maximumChars-
  Object.values(result).reduce((n,item)=>n+usage(item),0),
  replanned:changed};
}
