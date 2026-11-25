// Optional owner-host diagnostic only. No downloads, credentials or model loads.
import {execFileSync} from 'node:child_process';
import {statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const py=`import sys,json,importlib.metadata as m
import torch
print(json.dumps(dict(python='.'.join(map(str,sys.version_info[:3])),torch=torch.__version__,transformers=m.version('transformers'),cudaDevices=torch.cuda.device_count())))`;
const defaultProbe=()=>JSON.parse(execFileSync('python3',['-c',py],{encoding:'utf8',timeout:20000,maxBuffer:16384,stdio:['ignore','pipe','pipe']}));
const defaultFile=p=>{try{return statSync(p).isFile();}catch{return false;}};
export function inspectSwatRuntime({probe=defaultProbe,file=defaultFile,sender,receiver,mapper}={}){
 let v={};try{v=probe()||{};}catch{}
 const softwareMatches=/^3\.10\.\d+$/.test(v.python)&&/^2\.6\.0(?:\+[\w.]+)?$/.test(v.torch)&&v.transformers==='5.2.0';
 const cudaDevices=Number.isSafeInteger(v.cudaDevices)&&v.cudaDevices>=0?v.cudaDevices:null;
 const trainingGpuCountMet=cudaDevices!==null&&cudaDevices>=2;
 const artifact=(p,name)=>{try{return typeof p==='string'&&p.length>0&&file(name?join(p,name):p)===true;}catch{return false;}};
 const senderConfigPresent=artifact(sender,'config.json'),receiverConfigPresent=artifact(receiver,'config.json'),mapperFilePresent=artifact(mapper);
 const checks={softwareMatches,trainingGpuCountMet,senderConfigPresent,receiverConfigPresent,mapperFilePresent};
 return {schemaVersion:1,status:Object.values(checks).every(Boolean)?'prerequisites_observed':'blocked',...checks,cudaDevices,cacheTransferVerified:false,modelInvocationPerformed:false,textFallback:true,note:'Local presence checks only; model weights, mapper compatibility, GPU memory, inference and deployment remain unverified.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [sender,receiver,mapper]=process.argv.slice(2);
 const result=inspectSwatRuntime({sender,receiver,mapper});
 console.log(JSON.stringify(result,null,2));
 if(result.status==='blocked')process.exitCode=1;
}
