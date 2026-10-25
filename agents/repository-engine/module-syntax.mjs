import {execFileSync} from 'node:child_process';
// Parse only. Node --check does not evaluate imports, top-level code or hooks.
export function checkCandidateModuleSyntax(patched,{parse=(args,source)=>execFileSync(process.execPath,args,{input:source,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:15000})}={}){
 for(const [path,source] of Object.entries(patched||{})){
  if(!/\.(?:mjs|cjs)$/.test(path))continue;
  try{parse(['--check','--input-type='+ (path.endsWith('.mjs')?'module':'commonjs')],source);}
  catch(error){throw Error('Candidate module syntax failed before review: '+path+'. after must contain plain replacement source, never unified-diff + or - prefixes, fences or duplicated unchanged text outside before. Preserve the exact before literal. '+String(error.stderr||error.message||error).slice(0,1800));}
 }
 return {parsedOnly:true,codeExecuted:false};
}
