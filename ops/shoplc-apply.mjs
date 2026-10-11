import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const API='https://api.github.com/repos/www-infinity4/QuantaPhi',base='aaf03b0a6e72b58c74794ec61735d50ffe15e01e',branch='repair/owner-shoplc-viewer-20261011';
const token=process.env.REPAIR_APP_TOKEN;if(!token)throw Error('App token required');
async function api(p,method='GET',body){const r=await fetch(API+p,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GitHub '+r.status+' '+p);return r.json();}
const current=await api('/branches/main');if(current.protected!==true||current.commit.sha!==base)throw Error('Main changed or unprotected');
const file=await api('/contents/workers/quantaphi-site/worker.js?ref='+base),original=Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8');
const expected=original.replace('quantaphi-org-v46-channel-wallet','quantaphi-org-v47-shoplc-same-origin').replace("if (route.repo === 'Bitcoin-Crusher' && /text\\/html/i.test(out.get('Content-Type') || '')) out.set('X-Frame-Options', 'SAMEORIGIN');","if (['Bitcoin-Crusher','ShopLC'].includes(route.repo) && /text\\/html/i.test(out.get('Content-Type') || '')) out.set('X-Frame-Options', 'SAMEORIGIN');");
const content=await fs.readFile('workers/quantaphi-site/worker.js','utf8');if(content!==expected||expected===original)throw Error('Staged Worker is not exact owner-approved patch');
const test=await fs.readFile('test/shoplc-embed.test.cjs','utf8');
const commit=await api('/git/commits/'+base);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'workers/quantaphi-site/worker.js',mode:'100644',type:'blob',content},{path:'test/shoplc-embed.test.cjs',mode:'100644',type:'blob',content:test}]});
const head=await api('/git/commits','POST',{message:'Allow ShopLC viewer only on the same Phi origin; retain unrelated frame restrictions',tree:tree.sha,parents:[base]});
await api('/git/refs','POST',{ref:'refs/heads/'+branch,sha:head.sha});
const pr=await api('/pulls','POST',{head:branch,base:'main',title:'Fix ShopLC refusing to connect inside the Phi viewer',body:'Owner-authorized repair: live browser click opens ShopLC viewer but upstream X-Frame-Options blocks embedding. Limit the existing SAMEORIGIN header exception to Bitcoin-Crusher and ShopLC HTML. Unrelated HTML and scripts retain upstream restrictions. No wallet or service-binding changes.\n\nThree focused Worker tests passed before this App-created PR. Review and GitHub protection remain required before merge. Deployment must preserve the CODEPHI service binding.\n\nBuild/test receipt: https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID});
console.log(JSON.stringify({prNumber:pr.number,prURL:pr.html_url,headSha:head.sha,baseSha:base,workerHash:crypto.createHash('sha256').update(content).digest('hex')}));
