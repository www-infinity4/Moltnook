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
  const take=full.length<=fileBudget?[{start:0,end:full.length}]:
   candidates.length?candidates.slice(0,2).map(x=>({start:Math.max(0,x.pos-Math.floor(fileBudget/4)),end:Math.min(full.length,x.pos+Math.floor(fileBudget/4))})):
    [{start:0,end:Math.min(fileBudget,full.length)}];
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
