// Native Bubbles text transport. Caller must authenticate/authorize the scope
// and supply only approved evidence. Hashes are integrity IDs, not signatures.
import { createHash } from 'node:crypto';
const LIMIT=64, ITEM=32768, TOTAL=131072, CACHE=128;
const bytes=s=>Buffer.byteLength(s,'utf8');
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function scopeKey(s){
 if(!exact(s,['jobId','repo','baseSha'])||typeof s.jobId!=='string'||!s.jobId||s.jobId.length>160||typeof s.repo!=='string'||!/^[-\w.]+\/[-\w.]+$/.test(s.repo)||s.repo.length>200||typeof s.baseSha!=='string'||!/^[a-f0-9]{40}$/.test(s.baseSha))throw Error('native_context_scope');
 return JSON.stringify([s.jobId,s.repo,s.baseSha]);
}
const idFor=(key,text)=>createHash('sha256').update(JSON.stringify([key,text])).digest('hex');
function size(text){
 if(typeof text!=='string')throw Error('native_context_invalid');
 const n=bytes(text);if(n>ITEM)throw Error('native_context_limit');return n;
}
export function packContext(scope,records,known=[]){
 const key=scopeKey(scope);
 if(!Array.isArray(records)||records.length>LIMIT||!Array.isArray(known)||known.length>CACHE)throw Error('native_context_limit');
 if(!known.every(hex))throw Error('native_context_invalid');
 const seen=new Set(known);let total=0;
 const entries=records.map(text=>{
  total+=size(text);if(total>TOTAL)throw Error('native_context_limit');
  const id=idFor(key,text);if(seen.has(id))return {id};seen.add(id);return {id,text};
 });
 return {version:1,scope:{jobId:scope.jobId,repo:scope.repo,baseSha:scope.baseSha},entries};
}
export function receiveContext(expected,packet,cache=new Map()){
 const key=scopeKey(expected);
 if(!exact(packet,['version','scope','entries'])||packet.version!==1||!Array.isArray(packet.entries)||!(cache instanceof Map))throw Error('native_context_invalid');
 if(scopeKey(packet.scope)!==key)throw Error('native_context_scope');
 if(packet.entries.length>LIMIT||cache.size>CACHE)throw Error('native_context_limit');
 const staged=new Map();let total=0;
 const records=packet.entries.map(entry=>{
  if(!(exact(entry,['id'])||exact(entry,['id','text']))||!hex(entry.id))throw Error('native_context_invalid');
  const text=Object.hasOwn(entry,'text')?entry.text:staged.has(entry.id)?staged.get(entry.id):cache.get(entry.id);
  if(text===undefined)throw Error('native_context_missing');
  total+=size(text);if(total>TOTAL)throw Error('native_context_limit');
  if(idFor(key,text)!==entry.id)throw Error('native_context_integrity');
  staged.set(entry.id,text);return text;
 });
 // Commit only after all entries validate; bounded FIFO cache, no persistence.
 for(const [id,text] of staged){cache.delete(id);cache.set(id,text);}
 while(cache.size>CACHE)cache.delete(cache.keys().next().value);
 return records;
}
