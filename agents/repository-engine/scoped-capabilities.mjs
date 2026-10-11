// Verified metadata about runners and deployment files in the pinned target repository.
// No new permissions, workflow edits, shell execution, or credential values.
import {safePath} from './patch.mjs';
import {WORKFLOW_EVIDENCE_PATH} from './workflow-evidence.mjs';

const CONFIG_PATHS=['workers/infinity-brain-clock/wrangler.toml','workers/quantaphi-site/wrangler.toml','wrangler.toml'];
const simple=(line)=>line.trim().slice(0,240);
const safeLine=(line)=> !/(\$\{\{\s*secrets\.|bearer\s+\S+|api[_-]?token\s*=|password\s*=|private[_-]?key)/i.test(line);
export async function discoverScopedCapabilities({paths,readWorkflow,readSource,maximumWorkflows=12}={}){
 if(!Array.isArray(paths)||typeof readWorkflow!=='function'||typeof readSource!=='function')throw TypeError('Pinned paths and read-only readers required');
 const workflows=paths.filter(p=>typeof p==='string'&&WORKFLOW_EVIDENCE_PATH.test(p)).sort().slice(0,maximumWorkflows);
 const result={schemaVersion:1,workflowInspection:'read_only',writerPolicy:'protected .github and credential paths remain excluded',
  existingWorkflows:[],testCommands:[],sourcePathFilters:[],runnerImages:[],permissions:[],
  cloudflare:[],limits:['Workflow path filters describe GitHub event triggers, not bot file-write authorization.',
   'Worker metadata does not prove account API credentials or deployment acceptance.',
   'No arbitrary workflow authoring, releases, or database mutations are granted.']};
 for(const file of workflows){
  let content;
  try{content=await readWorkflow(file)}catch{continue}
  if(typeof content!=='string'||content.length>40000)continue;
  const clean=content.split(/\r?\n/).filter(safeLine);
  const names=clean.filter(l=>/^\s*name:\s*[^#]+/.test(l)).slice(0,2).map(l=>simple(l).replace(/^name:\s*/,''));
  const jobs=clean.filter(l=>/^  [a-zA-Z0-9_-]+:\s*(?:#.*)?$/.test(l)&&!/^(?:on|permissions):/.test(l.trim())).slice(0,16).map(l=>l.trim().slice(0,-1));
  const images=clean.filter(l=>/^\s*runs-on:\s*[\w-]+/.test(l)).slice(0,5).map(l=>simple(l).replace(/^runs-on:\s*/,''));
  const commands=clean.filter(l=>/^\s*(?:-\s*)?run:\s*(?:node|npm|npx|python3|pytest|go test)\s+/.test(l)).slice(0,12).map(l=>simple(l).replace(/^(?:-\s*)?run:\s*/,''));
  const permitted=clean.filter(l=>/^\s*(?:contents|id-token|pull-requests|actions):\s*(?:read|write|none)\s*$/.test(l)).slice(0,8).map(simple);
  const filterLines=clean.filter(l=>/^\s*paths:\s*\[/.test(l)||/^\s*-\s*['"]?(?:agents|workers|scripts|src|test|tests|tools|index\.html|\.github)/.test(l)).slice(0,12).map(simple);
  result.existingWorkflows.push({path:file,names,jobs,runsOn:images,tests:commands,triggerPathSamples:filterLines});
  for(const a of images)if(!result.runnerImages.includes(a))result.runnerImages.push(a);
  for(const a of commands)if(!result.testCommands.includes(a))result.testCommands.push(a);
  for(const a of permitted)if(!result.permissions.includes(a))result.permissions.push(a);
  for(const a of filterLines)if(!result.sourcePathFilters.includes(a))result.sourcePathFilters.push(a);
 }
 result.existingWorkflows=result.existingWorkflows.slice(0,maximumWorkflows);
 result.testCommands=result.testCommands.slice(0,20);
 result.sourcePathFilters=result.sourcePathFilters.slice(0,16);
 result.permissions=result.permissions.slice(0,12);
 for(const file of CONFIG_PATHS.filter(p=>paths.includes(p))){
  try{safePath(file);const content=await readSource(file);if(typeof content!=='string'||content.length>15000)continue;
   const name=content.match(/^name\s*=\s*["']([\w-]+)["']/m)?.[1];
   const main=content.match(/^main\s*=\s*["']([^"']+)["']/m)?.[1];
   const bindingNames=[...content.matchAll(/^binding\s*=\s*["']([\w-]+)["']/gm)].map(m=>m[1]).slice(0,12);
   const dbNames=[...content.matchAll(/^database_name\s*=\s*["']([\w-]+)["']/gm)].map(m=>m[1]).slice(0,6);
   if(name||main)result.cloudflare.push({path:file,workerName:name||null,workerEntry:main||null,bindings:bindingNames,databases:dbNames,
    deploymentVerified:false,secretValuesAvailable:false});
  }catch{}
 }
 result.knownSourcePaths=paths.filter(p=>{try{safePath(p);return /\.(?:mjs|js|cjs|html|json|css|py|toml)$/.test(p)}catch{return false}}).slice(0,75);
 return result;
}
