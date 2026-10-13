import fs from 'node:fs/promises';
import path from 'node:path';
export async function archiveScreenshots(directory,{repository,commitSha},send){
 const entries=[];
 async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.(png|jpe?g)$/i.test(e.name))entries.push(p)}}
 await walk(directory);const saved=[];
 for(const [i,file]of entries.entries()){
  const bytes=await fs.readFile(file);if(bytes.length>2*1024*1024)throw Error('Screenshot exceeds archival size bound: '+path.basename(file));
  const png=/\.png$/i.test(file),name=String(i).padStart(4,'0')+'-'+path.basename(file).replace(/[^a-zA-Z0-9_.-]/g,'-').replace(/\./g,'-').slice(0,85)+(png?'.png':'.jpg');
  const result=await send('screenshots',{repository,commitSha,name,image:'data:image/'+(png?'png':'jpeg')+';base64,'+bytes.toString('base64')});
  if(!result.ok||!result.evidence?.key)throw Error('Screenshot archive unconfirmed');saved.push({file,key:result.evidence.key});
 }
 return saved;
}
