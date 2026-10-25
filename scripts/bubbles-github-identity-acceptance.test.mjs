import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeIdentityReply as grade} from './bubbles-github-identity-acceptance.mjs';
const good=()=>({state:'complete',result:{ok:true,repository:'www-infinity4/QuantaPhi',path:'README.md',output:'Actual README detail.',sourceUrl:'https://github.com/www-infinity4/QuantaPhi/blob/main/README.md',receipt:{tool:'github.read_file',status:'complete',sourceReadVerified:true}}});
test('read acceptance requires exact target and source receipt',()=>{
 assert.equal(grade(good()).pass,true);
 for(const url of ['https://github.com/www.infinity4/QuantaPhi/blob/main/README.md','https://github.com/other/QuantaPhi/blob/main/README.md','https://example.com/QuantaPhi','https://github.com/www-infinity4/QuantaPhi/blob/main/index.html']){
  const r=good();r.result.sourceUrl=url;assert.equal(grade(r).pass,false);
 }
 for(const patch of [{sourceReadVerified:false},{tool:'oracle.chat'},{status:'working'}]){
  const r=good();Object.assign(r.result.receipt,patch);assert.equal(grade(r).pass,false);
 }
 const wrong=good();wrong.result.repository='www.infinity4/QuantaPhi';assert.equal(grade(wrong).pass,false);
});
test('negative target must have an actual failed tool receipt, never a silent correction',()=>{
 assert.equal(grade(good(),{negative:true}).pass,false);
 const r=good();r.result.receipt={tool:'github.read_file',status:'failed',reason:'github_file_read_failed'};
 assert.equal(grade(r,{negative:true}).pass,true);
 r.result.receipt.tool='oracle.chat';assert.equal(grade(r,{negative:true}).pass,false);
});
