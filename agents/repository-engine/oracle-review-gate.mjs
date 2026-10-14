// Pure, fail-closed checks before independent model review or merge.
// Small non-sensitive Oracle CSS/typography work is the initial automated release scope.
export const SHA=/^[a-f0-9]{40}$/;
export const ROBOT_REVIEW_MARKER='Staged source commit: ';
const prohibited=/(^|\/)(\.github|\.env|node_modules|secrets?|credentials?|workers?|api|auth|wallet|ledger|payment|billing|token|mint|admin|security|deployment|wrangler|package(-lock)?\.json)(\/|\.|$)/i;
export function eligibleFiles(files){
 if(!Array.isArray(files)||!files.length||files.length>8)return {ok:false,reason:'No bounded changed-file evidence'};
 let changes=0;
 for(const f of files){
  if(!f||typeof f.filename!=='string'||f.filename.includes('..')||f.status==='removed'||f.status==='renamed')return {ok:false,reason:'Non-additive or invalid change'};
  if(prohibited.test(f.filename))return {ok:false,reason:'Protected functional/credential path: '+f.filename};
  if(!/\.(css|scss|md)$/i.test(f.filename))return {ok:false,reason:'Automatic merge restricted to style and documentation: '+f.filename};
  changes+=Number(f.changes||0);
  if(!Number.isFinite(changes)||changes>250)return {ok:false,reason:'Patch exceeds 250 changed lines'};
 }
 if(!files.some(f=>/\.(css|scss)$/i.test(f.filename)))return {ok:false,reason:'No Oracle style improvement'};
 return {ok:true,reason:'Bounded non-sensitive Oracle style change'};
}
export function verifyRobotPR(pr,files,checks,combined){
 if(!pr||pr.state!=='open'||pr.draft||pr.mergeable!==true||!SHA.test(pr.head?.sha||''))return {ok:false,reason:'PR must be open, mergeable, immutable and not draft'};
 if(!pr.base?.ref||pr.base.ref!=='main')return {ok:false,reason:'Unexpected default branch'};
 if(pr.head.repo?.full_name!==pr.base.repo?.full_name||!/^robot\//.test(pr.head.ref||''))return {ok:false,reason:'Only same-repository robot branches are eligible'};
 if(!String(pr.title||'').startsWith('Robot review: '))return {ok:false,reason:'Unrecognized bot PR provenance'};
 if(!String(pr.body||'').includes(ROBOT_REVIEW_MARKER+pr.head.sha))return {ok:false,reason:'Pinned reviewed head SHA missing'};
 const scope=eligibleFiles(files);if(!scope.ok)return scope;
 if(!Array.isArray(checks)||!checks.length)return {ok:false,reason:'No target-repository CI checks'};
 // Only real target-repo GitHub Actions checks count. A review-only check is not a test.
 const independent=checks.filter(c=>c.app?.slug==='github-actions'&&!/review|promot|ticket|inventory|audit/i.test(c.name||''));
 if(!independent.length)return {ok:false,reason:'No independent test/build check on head SHA'};
 if(independent.some(c=>c.status!=='completed'||c.conclusion!=='success'))return {ok:false,reason:'Independent target tests are pending/failed'};
 if(checks.some(c=>c.conclusion==='failure'||c.conclusion==='cancelled'||c.conclusion==='timed_out'||c.conclusion==='action_required'||c.status!=='completed'))return {ok:false,reason:'Another reported check is failed or pending'};
 if(combined?.state==='failure'||combined?.state==='pending')return {ok:false,reason:'Legacy commit status not successful'};
 return {ok:true,reason:'Source/CI scope passed; independent GPT review still required'};
}
export function parseModelVerdict(body,sha){
 if(!SHA.test(sha))throw Error('Unpinned review');
 const raw=String(body||'').trim();
 if(raw.length>3000||!raw.startsWith('{'))throw Error('Review output is not bounded JSON');
 let obj;try{obj=JSON.parse(raw)}catch{throw Error('Review output invalid JSON')}
 if(!obj||obj.sha!==sha||!['approve','reject'].includes(obj.decision)||typeof obj.reason!=='string'||obj.reason.length<15||obj.reason.length>700)throw Error('Review output does not match the exact commit SHA');
 return {decision:obj.decision,sha,reason:obj.reason};
}
