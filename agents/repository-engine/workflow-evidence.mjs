// Workflow source may be inspected for planning, but never edited by the robot's patch writer.
import fs from 'node:fs/promises';
import path from 'node:path';
export const WORKFLOW_EVIDENCE_PATH=/^\.github\/workflows\/[a-zA-Z0-9_.-]+\.ya?ml$/;
export async function readWorkflowEvidence(workspace,file,{maxBytes=40000}={}){
 if(typeof file!=='string'||file.length>180||!WORKFLOW_EVIDENCE_PATH.test(file))
  throw Error('Workflow evidence path rejected');
 let current=path.resolve(workspace);
 for(const segment of file.split('/')){
  current=path.join(current,segment);
  const stat=await fs.lstat(current);
  if(stat.isSymbolicLink())throw Error('Workflow evidence symlink rejected');
 }
 const content=await fs.readFile(current,'utf8');
 if(Buffer.byteLength(content,'utf8')>maxBytes)throw Error('Workflow evidence exceeds read-only limit');
 return content;
}
