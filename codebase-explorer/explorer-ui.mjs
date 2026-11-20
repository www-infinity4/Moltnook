import {ALLOWED_REPOS,selectRepository,normalizeTree,directoryTiles,layoutTiles,sourceLink} from './explorer-core.mjs';

const $=id=>document.getElementById(id);
const chooser=$('repository'),status=$('status'),meta=$('meta'),search=$('search');
const canvas=$('treemap'),ctx=canvas.getContext('2d');
const directory=$('directory'),list=$('file-list'),more=$('more');
let active=null,revision=null,prefix='',repoKey='moltnook',pending=false;

for(const [key,value] of Object.entries(ALLOWED_REPOS)){
 const option=document.createElement('option');option.value=key;option.textContent=value.label;chooser.append(option);
}
function report(message,kind='neutral'){
 status.textContent=message;
 status.dataset.kind=kind;
}
function pathButton(label,path,isDirectory){
 const button=document.createElement('button');
 button.type='button';button.textContent=label;
 button.addEventListener('click',()=>{
  if(isDirectory){prefix=path;search.value='';render();}
  else window.open(sourceLink(repoKey,revision,path),'_blank','noopener,noreferrer');
 });
 return button;
}
function drawMap(nodes){
 const display=nodes.slice(0,80);
 const width=Math.max(320,canvas.getBoundingClientRect().width||320);
 const height=300;
 const dpr=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.clearRect(0,0,width,height);
 ctx.fillStyle='#eee8e0';ctx.fillRect(0,0,width,height);
 const pal=['#c8d8e7','#d1e4d5','#ead1b9','#dfcee3','#eedfba','#d3d9eb'];
 const tiles=layoutTiles(display,width,height);
 tiles.forEach((tile,i)=>{
  ctx.fillStyle=pal[i%pal.length];ctx.fillRect(tile.x+1,tile.y+1,Math.max(0,tile.width-2),Math.max(0,tile.height-2));
  ctx.strokeStyle='#72655a';ctx.lineWidth=.6;ctx.strokeRect(tile.x+1,tile.y+1,Math.max(0,tile.width-2),Math.max(0,tile.height-2));
  if(tile.width>78&&tile.height>30){
   ctx.fillStyle='#312722';ctx.font='600 12px system-ui';
   const name=tile.name.length>18?tile.name.slice(0,15)+'…':tile.name;
   ctx.fillText(name,tile.x+6,tile.y+18,Math.max(0,tile.width-12));
  }
 });
}
function render(){
 if(!active)return;
 const needle=search.value.trim().toLowerCase();
 const found=needle?active.files.filter(f=>f.path.toLowerCase().includes(needle)):active.files;
 const nodes=directoryTiles(found,prefix);
 directory.replaceChildren();
 const root=pathButton('Root','',true);directory.append(root);
 let breadcrumb='';
 for(const part of prefix.split('/').filter(Boolean)){
  breadcrumb=breadcrumb?`${breadcrumb}/${part}`:part;
  directory.append(pathButton(` / ${part}`,breadcrumb,true));
 }
 list.replaceChildren();
 drawMap(nodes);
 for(const item of nodes.slice(0,60)){
  const li=document.createElement('li'),button=pathButton(`${item.directory?'📁':'📄'} ${item.name} · ${item.files} file${item.files===1?'':'s'} · ${Intl.NumberFormat().format(item.bytes)} bytes`,item.path,item.directory);
  li.append(button);list.append(li);
 }
 more.textContent=nodes.length>60?`Showing 60 of ${nodes.length} entries. Narrow the search or enter a directory.`:
  nodes.length?`Showing ${nodes.length} source-backed entries. Select a folder to inspect it.`:'No matching source files at this level.';
 meta.textContent=`Pinned commit ${revision.slice(0,12)} · ${Intl.NumberFormat().format(active.files.length)} indexed files · ${Intl.NumberFormat().format(active.totalBytes)} blob bytes · ${active.complete?'GitHub returned a complete tree':'Partial index: GitHub truncated or capped the tree'}. This is not a line-of-code count.`;
}
async function getJSON(url){
 const response=await fetch(url,{headers:{Accept:'application/vnd.github+json'}});
 if(!response.ok)throw new Error(response.status===403?'GitHub rate limit or access restriction. Please retry later.':`GitHub request failed (${response.status}).`);
 return response.json();
}
async function load(){
 if(pending)return;
 pending=true;$('load').disabled=true;
 repoKey=chooser.value;
 prefix='';search.value='';report('Reading public GitHub source metadata…');
 list.replaceChildren();more.textContent='';meta.textContent='';
 try{
  const repo=selectRepository(repoKey).fullName;
  const commit=await getJSON(`https://api.github.com/repos/${repo}/commits/main`);
  if(!/^[a-f0-9]{40}$/i.test(commit.sha))throw new Error('GitHub returned an invalid commit revision.');
  const tree=await getJSON(`https://api.github.com/repos/${repo}/git/trees/${commit.sha}?recursive=1`);
  revision=commit.sha;
  active=normalizeTree({...tree,sha:revision});
  report(`Loaded ${selectRepository(repoKey).label} from GitHub. Read-only explorer.`,'ok');
  render();
 }catch(error){
  active=null;revision=null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  report(error instanceof Error?error.message:'Could not read repository source.','error');
 }finally{pending=false;$('load').disabled=false;}
}
$('load').addEventListener('click',load);
chooser.addEventListener('change',()=>{active=null;load();});
search.addEventListener('input',()=>{if(active)render();});
window.addEventListener('resize',()=>{if(active)render();});
load();

