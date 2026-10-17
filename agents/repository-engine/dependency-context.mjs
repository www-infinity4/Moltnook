import {createHash} from 'node:crypto';
const OWNER='www-infinity4',SHA=/^[a-f0-9]{40}$/;
const KNOWN=['QuantaPhi','Omni-Phi','ShopLC','TV-Database','Moltnook','Oracle-Octaves','Code-Phi','Infinity-Phi','News-Phi','Quant-AI','WidgetPhi'];
const safe=p=>typeof p==='string'&&!p.startsWith('/')&&!p.split('/').some(x=>!x||x==='.'||x==='..')&&!/(?:^|\/)(?:\.env(?:\.|$)|node_modules|\.git)(?:\/|$)/.test(p)&&/^[\w./-]+$/.test(p);
export function dependencyRequests(task,target){
 const text=String(task||'').slice(0,12000),requests=new Map();
 const add=(name,file)=>{if(!/^[\w.-]+$/.test(name))return;const repo=OWNER+'/'+name;if(repo===target)return;const files=requests.get(repo)||new Set(['README.md','AGENTS.md']);if(file&&safe(file))files.add(file);requests.set(repo,files)};
 for(const name of KNOWN)if(new RegExp('\\b'+name+'\\b','i').test(text))add(name);
 for(const match of text.matchAll(/(?:www-infinity4\/)?([A-Za-z0-9_.-]+)\/((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:mjs|cjs|js|css|html|md|json))/g))if(KNOWN.some(n=>n.toLowerCase()===match[1].toLowerCase()))add(KNOWN.find(n=>n.toLowerCase()===match[1].toLowerCase()),match[2]);
 // When a ticket names a different owner repository and lists paths after it,
 // collect the named files from that repository's pinned tree, not this clone.
 // Basenames (for example runner-auth.mjs) resolve only when uniquely present.
 for(const name of KNOWN){
  const repo=OWNER+'/'+name;if(repo===target)continue;
  const match=new RegExp('\\\\b'+name.replaceAll('-','\\\\-')+'\\\\b','i').exec(text);
  if(!match)continue;
  const context=text.slice(match.index,match.index+800);
  for(const file of context.matchAll(/(?:^|[\\s,\\x60])((?:(?:workers|scripts|agents|src|test|tests|utils)\\/)?(?:[A-Za-z0-9_.-]+\\/)*[A-Za-z0-9_.-]+\\.(?:mjs|cjs|js|ts|tsx|py))(?:[\\s,;\\x60]|$)/g))add(name,file[1]);
 }
 // Canonical design references are read-only dependencies of every page job.
 add('Oracle-Octaves','index.html');add('QuantaPhi','oracle-interface.css');
 return [...requests].slice(0,6).map(([repository,files])=>({repository,files:[...files].slice(0,5)}));
}
export async function collectDependencyContext({task,target,github}){
 const output={schemaVersion:1,writableRepository:target,readOnly:true,repositories:[]};
 for(const request of dependencyRequests(task,target)){
  const row={repository:request.repository,status:'unverified',readOnly:true,files:[]};output.repositories.push(row);
  try{
   const meta=await github('repos/'+request.repository);
   if(meta.full_name?.toLowerCase()!==request.repository.toLowerCase()||!meta.default_branch)throw Error('Dependency repository identity unavailable');
   const commit=await github('repos/'+request.repository+'/commits/'+encodeURIComponent(meta.default_branch));
   if(!SHA.test(commit.sha||''))throw Error('Dependency commit unavailable');row.commitSha=commit.sha;
   const tree=await github('repos/'+request.repository+'/git/trees/'+commit.sha+'?recursive=1');
   if(tree.truncated||!Array.isArray(tree.tree))throw Error('Dependency tree incomplete');
   const paths=tree.tree.filter(x=>x.type==='blob'&&safe(x.path));
   row.tree=paths.map(x=>x.path).slice(0,180);row.treeTotal=paths.length;row.treeExcerpt=paths.length>180;
   for(const file of request.files){
    const exact=paths.find(x=>x.path===file);
    const basenameMatches=file.includes('/')?[]:paths.filter(x=>x.path.endsWith('/'+file));
    const entry=exact||(basenameMatches.length===1?basenameMatches[0]:null);
    if(!entry){row.files.push({path:file,status:basenameMatches.length>1?'ambiguous_path':'missing_at_pinned_commit'});continue}
    if(entry.size>400000){row.files.push({path:file,status:'too_large',blobSha:entry.sha});continue}
    const blob=await github('repos/'+request.repository+'/git/blobs/'+entry.sha);
    if(blob.encoding!=='base64'||typeof blob.content!=='string')throw Error('Dependency blob unavailable');
    const bytes=Buffer.from(blob.content.replace(/\s/g,''),'base64');
    const digest=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
    if(digest!==entry.sha||bytes.length>400000)throw Error('Dependency blob hash mismatch');
    const content=bytes.toString('utf8');row.files.push({path:entry.path,requestedPath:file,status:'verified_source',blobSha:entry.sha,url:'https://github.com/'+request.repository+'/blob/'+commit.sha+'/'+file,excerpt:content.slice(0,2200),excerptTruncated:content.length>2200});
   }
   row.status='verified_read_only';
  }catch(error){row.status='blocked';row.reason=String(error.message||error).slice(0,180)}
 }
 return output;
}
