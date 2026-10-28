import path from 'node:path';
export function safePath(value){
 if(typeof value!=='string'||value.length>240||value.includes('\\')||/[\u0000-\u001f\u007f]/.test(value)||value.startsWith('/'))throw Error('Source path is outside writer policy');
 // Case-insensitive denylist: source checkouts can move between filesystems.
 // Never let a case-variant credential path bypass the writer policy.
 const parts=value.toLowerCase().split('/');
 // Reject sensitive dotfiles in ANY directory, not just at repository root.
 // Preserve ordinary .github workflows and .gitignore source files.
 if(parts.some(x=>!x||x==='.'||x==='..'||x==='.git'||x==='.env'||x.startsWith('.env.')||
  ['.envrc','.npmrc','.netrc','.pypirc','.ssh','.aws'].includes(x))||
  /(?:^|\/)(?:credentials|secrets?)(?:\.|\/|$)/i.test(value))throw Error('Source path is outside writer policy');
 return value;
}

/*
 * A duplicated object-entry line is a real text diff but not a useful
 * implementation. Reject additions that ONLY repeat object entries already
 * present in the pinned source; do not treat them as an accepted Green patch.
 * This check complements (not replaces) independent Pink intent review.
 */
export function duplicateOnlyObjectEntries(before,after){
 if(typeof before!=='string'||typeof after!=='string'||before===after)return false;
 const frequencies=text=>{
  const counts=new Map();
  for(const line of text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))
   counts.set(line,(counts.get(line)||0)+1);
  return counts;
 };
 const old=frequencies(before),next=frequencies(after);
 for(const [line,count] of old)if((next.get(line)||0)<count)return false;
 let repeated=0;
 for(const [line,count] of next){
  const extra=count-(old.get(line)||0);
  if(extra<=0)continue;
  if(!old.has(line)||!/^(?:['"][^'"]+['"]|[A-Za-z_$][\w$]*)\s*:\s*.+/.test(line))return false;
  repeated+=extra;
 }
 return repeated>0;
}

export function applyEdits(original,edits){
 if(!Array.isArray(edits)||!edits.length||edits.length>12)throw Error('No bounded implementation patch');
 const patched={};let size=0;
 for(const e of edits){safePath(e.path);if(typeof e.after!=='string')throw Error('Patch content missing');size+=(e.before?.length||0)+e.after.length;if(size>60000)throw Error('Patch exceeds per-iteration size');
  const prior=Object.hasOwn(patched,e.path)?patched[e.path]:original[e.path];
  if(e.before===null){if(prior!==null)throw Error('New file already exists');patched[e.path]=e.after;}
  else {
   // A failed immutable match must identify the failing *path* and match
   // count. Never include the source text, the proposed edit, or credentials.
   const matches=typeof prior==='string'&&typeof e.before==='string'&&e.before
    ?prior.split(e.before).length-1:0;
   if(typeof prior!=='string'||typeof e.before!=='string'||!e.before||matches!==1){
    const error=new Error('Edit must match immutable source exactly once: path='+JSON.stringify(e.path)+', matches='+matches+', source='+(typeof prior==='string'?'present':'missing'));
    error.code='immutable_edit_match_count';
    error.sourcePath=e.path;
    error.matchCount=matches;
    throw error;
   }
   patched[e.path]=prior.replace(e.before,e.after);
  }
 }
 if(!Object.keys(patched).some(p=>patched[p]!==original[p]))throw Error('Patch made no source change');
 for(const [file,after] of Object.entries(patched)){
  if(/\.(?:js|cjs|mjs|jsx|ts|tsx)$/.test(file)&&duplicateOnlyObjectEntries(original[file],after))
   throw Error('Patch only duplicates existing object entries; implement the requested behavior instead');
 }
 return patched;
}
export function inside(root,value){safePath(value);const absolute=path.resolve(root,value);if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Escaped source checkout');return absolute;}
