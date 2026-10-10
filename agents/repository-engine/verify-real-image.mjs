import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
// Explicit invocation makes ONE paid attempt. Never imported by scheduled repair loops.
if(process.argv[2]!=='--one-live-attempt')throw Error('Explicit single-attempt invocation required');
const receipt={when:new Date().toISOString(),provider:'existing Infinity Rogers Cloudflare image endpoint',verified:false,attempts:1};
try{
 const form=new FormData();for(const [k,v]of Object.entries({mode:'Image',reference_mode:'text-only',prompt:'A simple blue and gold geometric robot icon on white background, no letters or words',request:'Verify real image adapter once',exact_text:''}))form.append(k,v);
 const response=await fetch('https://infinity-rogers.marvaseater.workers.dev/v1/image',{method:'POST',headers:{Origin:'https://quantaphi.org'},body:form,redirect:'error',signal:AbortSignal.timeout(150000)});receipt.httpStatus=response.status;
 const j=await response.json();if(!response.ok||j.ok!==true||j.fixture===true)throw Error(String(j.code||j.error||'Provider failed'));
 const src=j.dataURI||j.imageDataURI||j.image?.dataURI||j.image?.url||j.imageUrl;
 if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(src))throw Error('Expected direct provider image bytes; external URLs require separate verification');
 const bytes=Buffer.from(src.split(',')[1],'base64');if(bytes.length<500||bytes.length>12*1024*1024)throw Error('Invalid image byte length');
 await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/real-image.bin',bytes);
 const dimensions=JSON.parse(execFileSync('python3',['-c','from PIL import Image;import json;im=Image.open("repository-receipts/real-image.bin");im.load();print(json.dumps(dict(width=im.width,height=im.height,format=im.format)))'],{encoding:'utf8'}));
 if(dimensions.width<=24||dimensions.height<=24)throw Error('Fixture-sized image rejected');
 Object.assign(receipt,dimensions,{verified:true,renderer:j.renderer||j.model||null,sha256:createHash('sha256').update(bytes).digest('hex')});
}catch(e){receipt.error=String(e.message).slice(0,300);process.exitCode=1;}
await fs.mkdir('repository-receipts',{recursive:true});await fs.writeFile('repository-receipts/real-image-verification.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
