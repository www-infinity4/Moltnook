import path from 'node:path';
export function safePath(value){
 if(typeof value!=='string'||value.length>240||value.includes('\\')||value.startsWith('/')||value.split('/').some(x=>!x||x==='.'||x==='..')||/^(?:\.git|\.github)(?:\/|$)|^\.env(?:[.\/]|$)/.test(value)||/(?:^|\/)(?:credentials|secrets?)(?:\.|\/|$)/i.test(value))throw Error('Source path is outside writer policy');
 return value;
}
export function applyEdits(original,edits){
 if(!Array.isArray(edits)||!edits.length||edits.length>12)throw Error('No bounded implementation patch');
 const patched={};let size=0;
 for(const e of edits){safePath(e.path);if(typeof e.after!=='string')throw Error('Patch content missing');size+=(e.before?.length||0)+e.after.length;if(size>60000)throw Error('Patch exceeds per-iteration size');
  const prior=Object.hasOwn(patched,e.path)?patched[e.path]:original[e.path];
  if(e.before===null){if(prior!==null)throw Error('New file already exists');patched[e.path]=e.after;}
  else {if(typeof prior!=='string'||typeof e.before!=='string'||!e.before||prior.split(e.before).length!==2)throw Error('Edit must match immutable source exactly once');patched[e.path]=prior.replace(e.before,e.after);}
 }
 if(!Object.keys(patched).some(p=>patched[p]!==original[p]))throw Error('Patch made no source change');
 return patched;
}
export function inside(root,value){safePath(value);const absolute=path.resolve(root,value);if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Escaped source checkout');return absolute;}
