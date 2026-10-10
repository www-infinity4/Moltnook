import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
// Exact bytes prove published source, not working interactions or wallet balances.
export async function observeLiveSource({repository,commitSha,patched,fetcher=fetch}){
 const receipt={schemaVersion:1,commitSha,checkedAt:new Date().toISOString(),status:'unsupported_route',featureAcceptance:false,files:[]};
 if(repository!=='www-infinity4/QuantaPhi')return receipt;
 for(const [file,source]of Object.entries(patched)){
  // HTML is rewritten by the edge; worker/server files are not public assets.
  if(!/\.(?:js|css|json|txt)$/.test(file)||/^(?:workers|tools|test|tests|agents|node_modules)\//.test(file)||file.split('/').some(p=>!p||p==='.'||p==='..'))continue;
  const url=new URL(file.split('/').map(encodeURIComponent).join('/'),'https://quantaphi.org/');url.searchParams.set('__infinity_receipt',commitSha);
  const row={path:file,url:url.href,expectedSha256:hash(source),matched:false};
  try{const response=await fetcher(url,{headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(15000)});row.httpStatus=response.status;
   if(response.ok){const bytes=await response.arrayBuffer();if(bytes.byteLength>1024*1024)throw Error('Live source exceeds receipt limit');row.observedSha256=hash(Buffer.from(bytes));row.matched=row.observedSha256===row.expectedSha256;}
  }catch(e){row.error=String(e.message).slice(0,300);}
  receipt.files.push(row);
 }
 receipt.status=receipt.files.length?(receipt.files.every(r=>r.matched)?'published_source_matches':'published_source_mismatch'):'no_exact_public_assets';
 receipt.note='Read-only live source observation. Does not deploy workers, apply migrations, verify UI behavior, or mark the job complete.';
 return receipt;
}
