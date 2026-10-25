import {checkVisibleEdits,sha256} from './context-windows.mjs';
import {applyEdits} from './patch.mjs';
export function sourceDraftRetry(feedback){
 return feedback?.stage==='build'&&/Model attempted an edit outside the pinned source windows|Engineer attempted files absent from the reader handoff/.test(feedback.reason||'');
}
export function retainSourceExactDrafts(original,packet,edits,{maxChars=24000}={}){
 const result=[];let size=0;
 for(const edit of Array.isArray(edits)?edits.slice(0,12):[]){
  const item=packet?.source?.[edit?.path],source=original?.[edit?.path];
  if(!item||(item.kind==='existing'&&(typeof source!=='string'||sha256(source)!==item.sha256)))continue;
  if(!checkVisibleEdits(packet,[edit]))continue;
  try{applyEdits(original,[edit]);}catch{continue;}
  const bytes=JSON.stringify(edit).length;
  if(size+bytes>Math.min(24000,maxChars))continue;
  size+=bytes;result.push({...edit});
 }
 return result;
}
export function mergeSourceDrafts(drafts,edits){
 if(!Array.isArray(edits)||edits.length===0)return edits;
 const merged=new Map();
 for(const edit of [...(Array.isArray(drafts)?drafts:[]),...edits]){
  if(!edit||typeof edit!=='object'){merged.set(Symbol(),edit);continue;}
  merged.set(JSON.stringify([edit.path,edit.before]),edit);
 }
 if(merged.size>12)throw Error('Combined unapplied draft exceeds 12 edits; correct existing draft entries instead of duplicating them');
 return [...merged.values()];
}
