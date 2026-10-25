// Immutable, size-limited model windows. The runner retains each FULL source and
// applies the model's literal before/after edits only after exact-source checks.
// Source windows are evidence, never authority to change unshown parts of files.
import {createHash} from 'node:crypto';
export const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
const WORD=/[a-z][a-z0-9_-]{3,}/gi;
const STOP=new Set('that this from with have will into when where which should could everything project existing repository files source page build code bot agent make change work layout update something requested current about outside main work current fix create ensure checks original'.split(' '));
function words(v){return [...new Set(String(v||'').match(WORD)||[])].map(x=>x.toLowerCase()).filter(x=>!STOP.has(x)).slice(0,65);}
function namedDefinitions(full,request){
 const names=[...new Set(String(request||'').slice(0,12000).match(/\b[A-Za-z_$][A-Za-z0-9_$]*[A-Z][A-Za-z0-9_$]*\b/g)||[])].slice(0,24);
 return names.flatMap(name=>{
  const literal=name.replace(/[$]/g,'\\$');
  const pattern=new RegExp('^(?:export\\s+)?(?:async\\s+)?function\\s+'+literal+'\\s*\\(','m');
  const match=pattern.exec(full);return match?[match.index]:[];
 });
}
// Translate a small set of precise context requests into positions in the
// pinned checkout. Generic word matches often stop at early array.push calls
// and never reach the actual git publication code near the end of a file.
// These positions select evidence only; all existing edit/hash gates apply.
function requestedAnchors(full,request){
 const text=String(request||'').slice(0,12000),positions=namedDefinitions(full,request);
 if(/\bgit\s+push\b/i.test(text)){
  const pattern=/\b(?:git\s*\(\s*['"]push['"]|command\s*\(\s*['"]git['"]\s*,\s*\[\s*['"]push['"]|git\s+push\b)/gi;
  for(const match of full.matchAll(pattern))positions.push(match.index);
 }
 if(/<\/body>|\bclosing\s+body\b/i.test(text)){
  const at=full.toLowerCase().lastIndexOf('</body>');if(at>=0)positions.push(at);
 }
 // A named code symbol or literal must actually occur in the immutable file.
 for(const match of text.matchAll(/`([^`\n]{4,160})`/g)){
  let at=-1,count=0;
  while(count<4&&(at=full.indexOf(match[1],at+1))>=0){positions.push(at);count++;}
 }
 const unique=[...new Set(positions)];
 return /\bfinal\b/i.test(text)?unique.sort((a,b)=>b-a):unique;
}
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
  const candidates=requestedAnchors(full,task).map((pos,index)=>({pos,score:1000-index}));
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
  else if(namedDefinitions(full,task).length){
   // A named function's definition is more useful than its early call sites.
   // Keep one contiguous forward view so short function bodies are not split
   // by the generic two-window, fifteen-line heuristic. Same byte/hash budget.
   const start=namedDefinitions(full,task)[0];
   take.push({start,end:Math.min(full.length,start+fileBudget)});
  }else{
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
// Canonicalize only a harmless model wrapper when its sole text value is
// already an exact literal in a pinned source window. Never guess unseen
// source, unwrap arbitrary objects, or relax the normal patch/review gates.
export function normalizeVisibleEdits(packet,edits){
 if(!Array.isArray(edits))return edits;
 return edits.map(edit=>{
  if(!edit||typeof edit!=='object'||Array.isArray(edit))return edit;
  const item=packet?.source?.[edit.path],before=edit.before;
  if(item?.kind!=='existing'||!before||typeof before!=='object'||Array.isArray(before))return edit;
  if(Object.keys(before).length!==1||typeof before.text!=='string'||!before.text)return edit;
  if(!item.windows?.some(w=>w.text.includes(before.text)))return edit;
  return {...edit,before:before.text};
 });
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
  if(item.kind==='new')return e.before===null&&e.after.length<=15000?null:
   'Edit '+i+': new file requires before:null (JSON null, not empty string or a source object), full after content, maximum 15000 characters; received before type '+(e.before===null?'null':typeof e.before)+', after length '+e.after.length+'.';
  if(typeof e.before!=='string')return 'Edit '+i+': existing file before must be a plain JSON string (not a window object or regex) copied from a shown source window; received before type '+typeof e.before+'.';
  if(!e.before)return 'Edit '+i+': existing file before is an empty string. Copy a nonempty exact literal from a shown source window.';
  if(!item.windows?.some(w=>w.text.includes(e.before)))return 'Edit '+i+': existing file before is a string, but it does not match any shown source window. Select exact visible characters; do not infer unshown content.';
  // Do not tell Green that a valid sibling edit is broken. Only the actual
  // rejection belongs in retry feedback.
  return null;
 }).slice(0,12).filter(Boolean).join(' ') || 'All individual edit fields passed; check the complete proposal.';
}

/** Facts about rejected literals, never the full hidden source or edit text.
 * This helps Green distinguish an unshown exact match from a hallucinated
 * source literal without relaxing immutable-window approval.
 */
export function rejectedEditFacts(original,packet,edits){
 if(!Array.isArray(edits))return [];
 return edits.slice(0,12).map((edit,index)=>{
  const item=packet?.source?.[edit?.path];
  if(!item)return {index,status:'path_not_in_signed_plan'};
  if(typeof edit.after!=='string')return {index,status:'after_must_be_string'};
  if(item.kind==='new')return {index,status:edit.before===null&&edit.after.length<=15000?
   'valid_new_file_contract':'invalid_new_file_contract',requiredBefore:'json_null',maxAfterChars:15000};
  if(typeof edit.before!=='string'||!edit.before)return {index,status:'before_must_be_nonempty_literal'};
  const full=original?.[edit.path];
  if(typeof full!=='string')return {index,status:'pinned_source_unavailable'};
  const shown=item.windows?.some(w=>w.text.includes(edit.before))===true;
  if(shown)return {index,status:'exact_literal_visible'};
  const at=full.indexOf(edit.before);
  return {index,status:at<0?'literal_absent_from_pinned_source':'literal_outside_current_window',
   exactInPinnedSource:at>=0,uniqueInPinnedSource:at>=0&&full.indexOf(edit.before,at+1)<0};
 });
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
  if(focus<0)focus=requestedAnchors(full,task).find(at=>!inPrior(at))??-1;
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

// Short exact literals reduce transcription errors when Green only needs to
// insert a bounded change. These are hints, not edits or permission: normal
// visible-window, full-source uniqueness, review and test gates still apply.
export function visibleEditAnchors(original,packet,{task='',maximum=4}={}){
 const output={};
 const count=Math.max(1,Math.min(4,Number.isInteger(maximum)?maximum:4));
 const hints=words(task);
 for(const [path,item] of Object.entries(packet?.source||{})){
  const full=original?.[path];
  if(item?.kind!=='existing'||typeof full!=='string'||sha256(full)!==item.sha256)continue;
  const candidates=[];
  for(const window of item.windows||[]){
   if(typeof window.text!=='string'||window.sha256!==sha256(window.text)||
      full.slice(window.start,window.end)!==window.text)continue;
   for(const match of window.text.matchAll(/^[^\n]+/gm)){
    const line=match[0];
    if(!/^\s*(?:(?:export\s+)?(?:async\s+)?function\b|(?:const|let)\s+|(?:jobs|context|sourceJob)\.|if\s*\(|return\s)/.test(line))continue;
    const before=line.length>240?line.slice(0,120):line;
    if(before.trim().length<12||full.indexOf(before)<0||
       full.indexOf(before,full.indexOf(before)+1)>=0)continue;
    const score=hints.filter(term=>before.toLowerCase().includes(term)).length+
     (/function\b|\b(?:instruction|jobs\.push|technical_handoffs)/.test(before)?3:0);
    candidates.push({before,score,sha256:sha256(before)});
   }
  }
  candidates.sort((a,b)=>b.score-a.score||a.before.length-b.before.length);
  const seen=new Set();
  const anchors=candidates.filter(x=>!seen.has(x.before)&&seen.add(x.before)).slice(0,count)
   .map(({before,sha256})=>({before,sha256}));
  if(anchors.length)output[path]={sourceSha256:item.sha256,anchors};
 }
 return output;
}
