/** Bubbles read-only public repository map. No checkout, tokens, source execution or AI context stuffing. */
export const ALLOWED_REPOS = Object.freeze({
  moltnook: Object.freeze({fullName:'www-infinity4/Moltnook',label:'Moltnook · Bubbles Brain'}),
  quantaphi: Object.freeze({fullName:'www-infinity4/QuantaPhi',label:'QuantaPhi · Website'}),
  makepad: Object.freeze({fullName:'makepad/makepad',label:'Makepad · Open-source framework'}),
});
const SHA=/^[a-f0-9]{40}$/i;
const safePath=path=>typeof path==='string'&&path.length>0&&path.length<=1024&&
 !path.startsWith('/')&&!path.includes('\\')&&!/[\u0000-\u001f\u007f]/.test(path)&&
 path.split('/').every(part=>part&&part!=='.'&&part!=='..');

export function selectRepository(key){
 if(typeof key!=='string'||!Object.hasOwn(ALLOWED_REPOS,key))throw new Error('Unsupported repository');
 return ALLOWED_REPOS[key];
}

export function normalizeTree(payload){
 if(!payload||!SHA.test(payload.sha)||!Array.isArray(payload.tree))throw new Error('Invalid GitHub tree response');
 const MAX_FILES=75000;
 const seen=new Set(),files=[];
 for(const entry of payload.tree){
  if(files.length===MAX_FILES)break;
  if(entry?.type!=='blob'||!safePath(entry.path)||!Number.isSafeInteger(entry.size)||entry.size<0||seen.has(entry.path))continue;
  seen.add(entry.path);
  files.push({path:entry.path,size:entry.size});
 }
 files.sort((a,b)=>a.path.localeCompare(b.path));
 return {
  sha:payload.sha,
  files,
  totalBytes:files.reduce((sum,item)=>sum+item.size,0),
  complete:payload.truncated!==true&&files.length<MAX_FILES,
 };
}

export function directoryTiles(files,prefix=''){
 if(!Array.isArray(files)||!(prefix===''||safePath(prefix)))return [];
 const full=prefix?`${prefix}/`:'';
 const groups=new Map();
 for(const file of files){
  if(!file||!safePath(file.path)||!Number.isSafeInteger(file.size)||file.size<0||!file.path.startsWith(full))continue;
  const rest=file.path.slice(full.length);
  if(!rest)continue;
  const part=rest.split('/')[0],directory=rest.includes('/'),path=full+part;
  const group=groups.get(path)||{name:part,path,directory,bytes:0,files:0};
  group.bytes+=file.size;group.files++;groups.set(path,group);
 }
 return [...groups.values()].sort((a,b)=>b.bytes-a.bytes||a.path.localeCompare(b.path));
}

export function layoutTiles(items,width,height){
 if(!Array.isArray(items)||!items.length||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return [];
 const valid=items.filter(i=>i&&Number.isFinite(i.bytes)&&i.bytes>=0);
 if(!valid.length)return [];
 let total=valid.reduce((n,item)=>n+Math.max(1,item.bytes),0);
 let x=0,y=0,w=width,h=height;
 return valid.map((item,i)=>{
  const last=i===valid.length-1,weight=Math.max(1,item.bytes);
  let rw=w,rh=h;
  if(!last){
   if(w>=h)rw=w*(weight/total);
   else rh=h*(weight/total);
  }
  const rect={...item,x,y,width:rw,height:rh};
  if(w>=h){x+=rw;w-=rw;}else{y+=rh;h-=rh;}
  total-=weight;
  return rect;
 });
}

export function sourceLink(repoKey,revision,path){
 const repo=selectRepository(repoKey);
 if(!SHA.test(revision))throw new Error('Invalid revision');
 if(!safePath(path))throw new Error('Invalid source path');
 return `https://github.com/${repo.fullName}/blob/${revision}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

