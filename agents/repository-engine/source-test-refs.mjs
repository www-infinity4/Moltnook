/* Pure, fail-closed source-reference scanner for pinned Pink tests.
 * It never runs source, reads package metadata, or grants a write capability.
 * Only static literal import/require/readFileSync references count.
 */
import {posix} from 'node:path';

function lex(source){
 const out=[];let i=0;
 while(i<source.length&&out.length<30000){
  const c=source[i],n=source[i+1];
  if(/\s/.test(c)){i++;continue;}
  if(c==='/'&&n==='/'){i+=2;while(i<source.length&&source[i]!=='\n')i++;continue;}
  if(c==='/'&&n==='*'){
   const end=source.indexOf('*/',i+2);
   if(end<0)return [];
   i=end+2;continue;
  }
  if(c==='"'||c==="'"){
   const quote=c;let value='',escaped=false,closed=false;i++;
   while(i<source.length){
    const d=source[i++];
    if(d==='\\'){escaped=true;if(i<source.length)i++;continue;}
    if(d===quote){closed=true;break;}
    if(d==='\n')return [];
    value+=d;
   }
   if(!closed)return [];
   out.push({type:'string',value,escaped});
   continue;
  }
  if(c===String.fromCharCode(96)){
   i++;let closed=false;
   while(i<source.length){
    const d=source[i++];
    if(d==='\\'){i++;continue;}
    if(d===String.fromCharCode(96)){closed=true;break;}
   }
   if(!closed)return [];
   out.push({type:'template'});continue;
  }
  if(c==='/'&&!(n==='/'||n==='*')){
   const prev=out.at(-1);
   const possibleRegex=!prev||
    (prev.type==='symbol'&&['=','(',':','[','{',',','!','?',';'].includes(prev.value))||
    (prev.type==='id'&&['return','throw','case'].includes(prev.value));
   if(possibleRegex){
    let j=i+1,inClass=false,escaped=false,closed=false;
    for(;j<source.length;j++){
     const d=source[j];
     if(d==='\n')break;
     if(escaped){escaped=false;continue;}
     if(d==='\\'){escaped=true;continue;}
     if(d==='['){inClass=true;continue;}
     if(d===']'){inClass=false;continue;}
     if(d==='/'&&!inClass){closed=true;break;}
    }
    if(closed){i=j+1;while(/[a-z]/i.test(source[i]||'')&&i<source.length)i++;out.push({type:'regex'});continue;}
   }
  }
  if(/[A-Za-z_$]/.test(c)){
   let value=c;i++;
   while(i<source.length&&/[A-Za-z0-9_$]/.test(source[i]))value+=source[i++];
   out.push({type:'id',value});continue;
  }
  out.push({type:'symbol',value:c});i++;
 }
 return out;
}
const str=t=>t?.type==='string'&&t.escaped!==true?t.value:null;
function resolvePath(spec,mode,testPath){
 if(typeof spec!=='string'||!spec||spec.includes('\0')||spec.includes('?')||
  spec.includes('#')||spec.startsWith('/')||spec.startsWith('\\'))return null;
 if(mode!=='cwd'&&!spec.startsWith('.'))return null;
 const from=mode==='cwd'?'':posix.dirname(testPath);
 const path=posix.normalize(posix.join(from,spec));
 if(!path||path==='.'||path==='..'||path.startsWith('../')||path.startsWith('/'))return null;
 return path;
}
const id=(t,value)=>t?.type==='id'&&t.value===value;
const sym=(t,value)=>t?.type==='symbol'&&t.value===value;

export function referencesChangedSource(source,testPath,changedPaths){
 if(typeof source!=='string'||source.length>250000||
  typeof testPath!=='string'||!Array.isArray(changedPaths))return false;
 const expected=new Set(changedPaths);
 const t=lex(source);
 const matches=(literal,mode)=>expected.has(resolvePath(literal,mode,testPath));
 for(let i=0;i<t.length;i++){
  if(id(t[i],'import')){
   if(matches(str(t[i+1]),'module'))return true;
   if(sym(t[i+1],'(')&&matches(str(t[i+2]),'module'))return true;
   for(let j=i+1;j<Math.min(i+45,t.length)&&!sym(t[j],';');j++){
    if(id(t[j],'from')&&matches(str(t[j+1]),'module'))return true;
   }
  }
  if(id(t[i],'require')&&sym(t[i+1],'(')&&matches(str(t[i+2]),'module'))return true;
  if(id(t[i],'readFileSync')&&sym(t[i+1],'(')){
   if(matches(str(t[i+2]),'cwd'))return true;
   if(id(t[i+2],'new')&&id(t[i+3],'URL')&&sym(t[i+4],'(')&&
    sym(t[i+6],',')&&id(t[i+7],'import')&&sym(t[i+8],'.')&&
    id(t[i+9],'meta')&&sym(t[i+10],'.')&&id(t[i+11],'url')&&
    matches(str(t[i+5]),'module'))return true;
  }
 }
 return false;
}
