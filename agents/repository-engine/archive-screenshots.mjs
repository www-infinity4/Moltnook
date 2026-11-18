import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
const MAX_IMAGE_BYTES=2*1024*1024;
const PNG=Buffer.from('89504e470d0a1a0a','hex');
const JPEG=Buffer.from('ffd8ff','hex');
export async function archiveScreenshots(directory,{repository,commitSha},send){
 if(!(await fs.lstat(directory).catch(()=>null))?.isDirectory())return [];
 const entries=[];
 async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&/\.(png|jpe?g)$/i.test(e.name))entries.push(p)}}
 await walk(directory);const saved=[];
 for(const [i,file]of entries.entries()){
  const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const png=/\.png$/i.test(file),magic=png?PNG:JPEG;
  let bytes;
  try{
   const stat=await handle.stat();
   if(!stat.isFile()||stat.size>MAX_IMAGE_BYTES)throw Error('Invalid screenshot file: '+path.basename(file));
   bytes=await handle.readFile();
   if(bytes.length>MAX_IMAGE_BYTES||!bytes.subarray(0,magic.length).equals(magic))
    throw Error('Invalid screenshot content: '+path.basename(file));
  }finally{await handle.close();}
  const name=String(i).padStart(4,'0')+'-'+path.basename(file).replace(/[^a-zA-Z0-9_.-]/g,'-').replace(/\./g,'-').slice(0,85)+(png?'.png':'.jpg');
  const result=await send('screenshots',{repository,commitSha,name,image:'data:image/'+(png?'png':'jpeg')+';base64,'+bytes.toString('base64')});
  if(!result.ok||!result.evidence?.key)throw Error('Screenshot archive unconfirmed');saved.push({file,key:result.evidence.key});
 }
 return saved;
}
