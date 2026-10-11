import {test} from 'node:test';
import assert from 'node:assert/strict';
import {REPOS,describeChange,candidates,acceptReview,issueBody} from './engine.mjs';
const source='www-infinity4/QuantaPhi';
test('discovers a real image-upload control as a reusable capability',()=>{
 const f=describeChange({filename:'picture-upload.js',status:'modified',additions:30,patch:'@@ -1 +1 @@\n+const control=document.createElement("button"); control.textContent="Upload image"; const picker=document.createElement("input"); picker.type="file"; picker.accept="image/*"; picker.addEventListener("change", ()=> previewImage(picker.files[0]));'});
 assert.ok(f);assert.ok(f.kinds.includes('upload'));assert.ok(f.kinds.includes('button'));
 const targets=candidates(source,f);assert.ok(targets.some(t=>t.repo==='www-infinity4/Omni-Phi'));
 const reviewed=acceptReview({decision:'reuse',targetRepo:'www-infinity4/Omni-Phi',confidence:0.87,summary:'Reuse the selected image picker in search cards',reason:'Omni image discovery needs user selected examples',adaptation:'Adapt its state and add mobile regression coverage'},source,'a'.repeat(40),f,targets);
 assert.equal(reviewed.target,'www-infinity4/Omni-Phi');
 const issue=issueBody(reviewed);assert.match(issue,/source:|source\*\*/i);assert.match(issue,/No automatic|creates no payout/i);
});
test('rejects invented destinations or weak unstructured AI opinions',()=>{
 const f=describeChange({filename:'gallery.js',status:'added',additions:60,patch:'+const img=document.createElement("img"); img.src="data:sample"; document.body.append(img); img.alt="Portable image example for reuse across Phi project pages";'});
 assert.ok(f);
 const targets=candidates(source,f);
 assert.equal(acceptReview({decision:'reuse',targetRepo:'somebody/evil',confidence:.99,summary:'an unsafe target',reason:'imaginary changes would help',adaptation:'automatically copy all contents'},source,'a'.repeat(40),f,targets),null);
 assert.equal(acceptReview({decision:'reuse',targetRepo:targets[0].repo,confidence:.2,summary:'not confident target',reason:'not enough evidence to proceed',adaptation:'need more evidence and implementation work'},source,'a'.repeat(40),f,targets),null);
});
test('limits sensitive and irrelevant source scanning',()=>{
 assert.equal(describeChange({filename:'.github/workflows/write.yml',status:'modified',patch:'+secret'}),null);
 assert.equal(describeChange({filename:'bundle.min.js',status:'modified',patch:'+all'}),null);
 assert.equal(describeChange({filename:'wallet.css',status:'removed',patch:'+button'}),null);
 assert.ok(REPOS.every(repo=>repo.startsWith('www-infinity4/')));
});
