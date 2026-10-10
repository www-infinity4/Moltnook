/* Infinity repo-local repair kit: deterministic, evidence-backed, no dependencies.
   Repairs only unambiguous local HTML asset links, never external URLs or data. */
import fs from 'node:fs/promises';
import path from 'node:path';
const cwd=process.cwd(),fix=process.argv.includes('--fix');
const ignored=new Set(['.git','node_modules','.next','dist','build','coverage','vendor','activity']);
const files=[];
async function walk(dir=''){
 for(const d of await fs.readdir(path.join(cwd,dir),{withFileTypes:true})){
  if(d.name.startsWith('.')||ignored.has(d.name))continue;
  const rel=path.posix.join(dir,d.name);
  if(d.isDirectory()){if(dir.split('/').length<7)await walk(rel)}
  else if(d.isFile()&&files.length<5000)files.push(rel);
 }
}
await walk();
const all=new Set(files),htmls=files.filter(p=>/\.html$/i.test(p)).slice(0,70),repairs=[],unresolved=[];
function candidate(file,href){
 let value=href.split(/[?#]/)[0];
 if(!value||/^(https?:|data:|mailto:|tel:|javascript:|\/\/|#)/i.test(value))return null;
 if(value.startsWith('/')||value.includes('{{'))return null;
 let decoded;try{decoded=decodeURIComponent(value)}catch{return null}
 if(decoded.endsWith('/'))decoded+='index.html';
 const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),decoded));
 if(target.startsWith('../')||target==='..'||all.has(target))return null;
 const basename=path.posix.basename(target).toLowerCase();
 if(!/\.(?:js|css|html|png|jpe?g|svg|json|webp|ico)$/i.test(basename))return null;
 const matches=files.filter(x=>path.posix.basename(x).toLowerCase()===basename);
 if(matches.length!==1){unresolved.push({file,reference:href,reason:matches.length?'ambiguous':'missing'});return null}
 const corrected=path.posix.relative(path.posix.dirname(file),matches[0])||'./';
 const fixed=corrected+href.slice(value.length);
 return fixed===href?null:{file,original:href,replacement:fixed,target:matches[0]};
}
for(const file of htmls){
 const source=await fs.readFile(file,'utf8');
 // Matches quoted literal HTML attributes, not computed script attributes.
 const updated=source.replace(/\b(src|href)=(["'])([^"']+)\2/g,(full,attr,q,value)=>{
   const match=candidate(file,value);
   if(!match)return full;
   repairs.push(match);return attr+'='+q+match.replacement+q;
 });
 if(fix&&updated!==source)await fs.writeFile(file,updated,'utf8');
}
const report={schemaVersion:1,when:new Date().toISOString(),
 runner:'Greenbeans repair / Pink Panther verification',
 mode:fix?'fix-and-report':'inspect-only',scannedHtml:htmls.length,
 scannedFiles:files.length,applied:fix?repairs.length:0,
 repairCandidates:repairs,unresolved,
 proof:'Only unique local file matches qualify for automatic repair.',
 sourceSha:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null};
await fs.mkdir(path.join(cwd,'activity'),{recursive:true});
await fs.writeFile(path.join(cwd,'activity','repair-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('Inspected '+htmls.length+' HTML pages, '+repairs.length+' safe candidates, '+unresolved.length+' unresolved.');
