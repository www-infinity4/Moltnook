import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {nodeTestBootstrap} from './runtime-baseline.mjs';

// Official Node 22 Debian image. The digest pins the Linux runner runtime.
const IMAGE='docker.io/library/node:22-bookworm@sha256:7702d8aa4d5910871692af4480eb3ba86f23047a6417a44d857d06c95d060d3f';
const BOOTSTRAP='/opt/infinity/node-test-globals.mjs';
const INSTALL=['install','--ignore-scripts','--package-lock=false','--no-audit','--no-fund'];

export async function withRepositorySandbox(workspace,run,{execute=execFileSync}={}){
 const uid=process.getuid?.(),gid=process.getgid?.();
 if(!uid||gid===undefined)throw Error('Repository checks require a non-root Linux runner');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'infinity-checks-'));
 const checkout=path.join(temp,'checkout');
 const docker=(args,timeout=180000)=>execute('docker',args,{
  env:{PATH:process.env.PATH,DOCKER_CONFIG:path.join(temp,'docker-config')},
  encoding:'utf8',timeout,maxBuffer:3*1024*1024,stdio:['ignore','pipe','pipe']
 });
 try{
  // Tests can write to this copy, which is discarded. The reviewed checkout
  // and its git index stay on the host with the authenticated controller.
  await fs.cp(workspace,checkout,{
   recursive:true,verbatimSymlinks:true,filter:file=>path.basename(file)!=='.git'
  });
  return await run((command,args)=>{
   const install=command==='npm'&&args[0]==='install';
   if(install&&JSON.stringify(args)!==JSON.stringify(INSTALL))throw Error('Unsafe dependency install arguments');
   const name='infinity-check-'+randomUUID();
   const options=[
    'run','--rm','--name',name,'--pull=missing','--network',install?'bridge':'none',
    '--user',uid+':'+gid,'--cap-drop=ALL','--security-opt=no-new-privileges',
    '--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=512m','--pids-limit=192',
    '--memory=4g','--cpus=2','--env','CI=true','--env','HOME=/tmp',
    '--mount','type=bind,source='+checkout+',target=/workspace',
    '--mount','type=bind,source='+nodeTestBootstrap+',target='+BOOTSTRAP+',readonly',
    '--workdir','/workspace'
   ];
   try{return docker([...options,IMAGE,command,...args.map(arg=>arg===nodeTestBootstrap?BOOTSTRAP:arg)]);}
   catch(error){
    // A timed-out Docker client can leave its container running.
    try{docker(['rm','--force',name],10000);}catch{}
    throw error;
   }
  });
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
