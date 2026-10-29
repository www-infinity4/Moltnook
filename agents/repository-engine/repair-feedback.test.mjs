import test from 'node:test';
import assert from 'node:assert/strict';
import {repairWithFeedback} from './repair-feedback.mjs';
test('malformed build replies preserve earlier independent review findings',async()=>{
 let calls=0;const receipts=[];
 const result=await repairWithFeedback({
  build:async f=>{calls++;if(calls===2)throw Error('Unexpected token in JSON');if(calls===3){assert.deepEqual(f.failures.map(x=>x.stage),['review','build']);assert.match(f.failures[0].reason,/SQLite/)}return {attempt:calls}},
  review:async c=>({approved:c.attempt!==1,reason:'SQLite ADD COLUMN IF NOT EXISTS is invalid'}),
  test:async()=>({passed:true}),arbitrate:async()=>({decision:'approve'}),restore:async()=>{},onFeedback:async f=>receipts.push(f)
 });
 assert.equal(result.attempt,3);assert.equal(receipts[0].failures.length,1,'older receipts must not mutate');
});
test('retry hands the previous authenticated failure to the engineer',async()=>{
 const initialFeedback={stage:'test',reason:'describe is not defined'};
 const result=await repairWithFeedback({initialFeedback,build:async previous=>{assert.deepEqual(previous,initialFeedback);return {};},review:async()=>({approved:true}),test:async()=>({passed:true}),arbitrate:async()=>({decision:'approve'}),restore:async()=>{assert.fail('unexpected restore')},onFeedback:async()=>{assert.fail('unexpected failure')}});
 assert.equal(result.attempt,1);
});
test('review rejection and failed tests return to engineer; only tested approved patch can finish',async()=>{
 let builds=0,restores=0,checks=0,arbitrations=0;const feedback=[];
 const result=await repairWithFeedback({
  build:async previous=>{builds++;if(builds>1)assert.equal(previous.reason,builds===2?'CommonJS imports invalid':'test failed');return {version:builds};},
  review:async c=>({approved:c.version!==1,reason:'CommonJS imports invalid'}),
  test:async()=>{checks++;if(checks===1)throw Error('test failed');return {passed:true,output:'real test result'};},
  arbitrate:async(c,review,tests)=>{arbitrations++;assert.equal(c.version,3);assert.equal(review.approved,true);assert.equal(tests.output,'real test result');return {decision:'approve'};},
  restore:async()=>{restores++;},onFeedback:async f=>feedback.push(f)
 });
 assert.equal(result.attempt,3);assert.equal(restores,2);assert.equal(arbitrations,1);assert.deepEqual(feedback.map(f=>f.stage),['review','test']);
});
test('Purple rejection cannot commit and repair retries stop at the bound',async()=>{
 let restored=0,builds=0;
 await assert.rejects(repairWithFeedback({build:async()=>{builds++;return {};},review:async()=>({approved:true}),test:async()=>({passed:true}),arbitrate:async()=>({decision:'reject',reason:'unmet owner requirement'}),restore:async()=>{restored++;},onFeedback:async()=>{}}),/attempts exhausted.*unmet owner requirement/);
 assert.equal(builds,3);assert.equal(restored,3);
});

test('typed immutable mismatch is carried into the next attempt without edit text',async()=>{
 let attempts=0;const seen=[];
 const result=await repairWithFeedback({
  build:async feedback=>{
   attempts++;
   if(attempts===1){
    const error=new Error('Edit must match immutable source exactly once');
    error.code='immutable_edit_match_count';
    error.sourcePath='src/page.js';error.matchCount=2;
    error.before='PRIVATE_SOURCE_MUST_NOT_TRAVEL';
    throw error;
   }
   assert.deepEqual(feedback.diagnostic,{code:'immutable_edit_match_count',sourcePath:'src/page.js',matchCount:2});
   assert.deepEqual(feedback.failures[0].diagnostic,feedback.diagnostic);
   assert.ok(!JSON.stringify(feedback).includes('PRIVATE_SOURCE_MUST_NOT_TRAVEL'));
   return {safe:true};
  },
  review:async()=>({approved:true}),test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
  onFeedback:async f=>seen.push(structuredClone(f))
 });
 assert.equal(result.attempt,2);
 assert.equal(seen[0].diagnostic.sourcePath,'src/page.js');
});

test('untrusted diagnostic fields never become file-path feedback',async()=>{
 for(const data of [
  {code:'immutable_edit_match_count',sourcePath:'../secrets',matchCount:0},
  {code:'immutable_edit_match_count',sourcePath:'.env',matchCount:0},
  {code:'immutable_edit_match_count',sourcePath:'src/page.js',matchCount:-1},
  {code:'arbitrary',sourcePath:'src/page.js',matchCount:1}
 ]){
  let attempts=0;
  const result=await repairWithFeedback({
   build:async feedback=>{
    if(++attempts===1)throw Object.assign(new Error('generic build failure'),data);
    assert.equal(feedback.diagnostic,undefined);
    assert.equal(feedback.failures[0].diagnostic,undefined);
    return {};
   },
   review:async()=>({approved:true}),test:async()=>({passed:true}),
   arbitrate:async()=>({decision:'approve'}),restore:async()=>{},onFeedback:async()=>{}
  });
  assert.equal(result.attempt,2);
 }
});

test('typed immutable feedback never copies upstream source text or nested credential paths',async()=>{
 for(const sourcePath of ['src/page.js','config/deep/.env','pkg/.npmrc','nested/.git/config','config/.ENV.production']){
  let attempts=0;
  const receipts=[];
  const result=await repairWithFeedback({
   build:async feedback=>{
    if(++attempts===1){
     const error=new Error('PRIVATE_TOKEN_SENTINEL in upstream edit text');
     error.code='immutable_edit_match_count';
     error.sourcePath=sourcePath;error.matchCount=2;
     throw error;
    }
    assert.equal(feedback.reason,'Immutable source edit did not match exactly once');
    assert.ok(!JSON.stringify(feedback).includes('PRIVATE_TOKEN_SENTINEL'));
    const safe=sourcePath==='src/page.js';
    assert.equal(Boolean(feedback.diagnostic),safe);
    assert.equal(Boolean(feedback.failures[0].diagnostic),safe);
    return {safe:true};
   },
   review:async()=>({approved:true}),test:async()=>({passed:true}),
   arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
   onFeedback:async feedback=>receipts.push(structuredClone(feedback))
  });
  assert.equal(result.attempt,2);
  assert.equal(receipts.length,1);
  assert.ok(!JSON.stringify(receipts).includes('PRIVATE_TOKEN_SENTINEL'));
  if(sourcePath!=='src/page.js')assert.ok(!JSON.stringify(receipts).includes(sourcePath));
 }
});


test('exhausted immutable edit retains only safe path/count in final job error',async()=>{
 for(const sourcePath of ['src/page.js','config/deep/.env','../secret.txt']){
  let restores=0;
  const work=repairWithFeedback({
   maxAttempts:1,
   build:async()=>{
    const error=new Error('PRIVATE_TOKEN_SENTINEL upstream text');
    error.code='immutable_edit_match_count';
    error.sourcePath=sourcePath;
    error.matchCount=2;
    throw error;
   },
   review:async()=>({approved:true}),
   test:async()=>({passed:true}),
   arbitrate:async()=>({decision:'approve'}),
   restore:async()=>{restores++},
   onFeedback:async()=>{}
  });
  await assert.rejects(work,error=>{
   assert.match(error.message,/Repair attempts exhausted: build: Immutable source edit did not match exactly once/);
   assert.ok(!error.message.includes('PRIVATE_TOKEN_SENTINEL'));
   if(sourcePath==='src/page.js'){
    assert.match(error.message,/path="src\/page.js", matches=2/);
    assert.equal(error.code,'immutable_edit_match_count');
    assert.equal(error.sourcePath,'src/page.js');
    assert.equal(error.matchCount,2);
   }else{
    assert.ok(!error.message.includes(sourcePath));
    assert.equal(error.sourcePath,undefined);
    assert.equal(error.matchCount,undefined);
   }
   return true;
  });
  assert.equal(restores,1);
 }
});


test('mutated feedback cannot smuggle a protected path into the terminal receipt',async()=>{
 const run=repairWithFeedback({
  maxAttempts:1,
  build:async()=>{
   const error=new Error('PRIVATE_TOKEN_SENTINEL');
   error.code='immutable_edit_match_count';
   error.sourcePath='src/page.js';
   error.matchCount=1;
   throw error;
  },
  review:async()=>({approved:true}),
  test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),
  restore:async()=>{},
  onFeedback:async feedback=>{
   feedback.diagnostic.sourcePath='config/.env';
   feedback.diagnostic.matchCount=999;
  }
 });
 await assert.rejects(run,error=>{
  assert.match(error.message,/Repair attempts exhausted/);
  assert.ok(!error.message.includes('config/.env'));
  assert.ok(!error.message.includes('PRIVATE_TOKEN_SENTINEL'));
  assert.equal(error.sourcePath,'src/page.js');
  assert.equal(error.matchCount,1);
  return true;
 });
});


test('mutated callback reason and stage cannot leak into terminal failure',async()=>{
 const run=repairWithFeedback({
  maxAttempts:1,
  build:async()=>{
   const error=new Error('PRIVATE_UPSTREAM_SECRET');
   error.code='immutable_edit_match_count';
   error.sourcePath='src/page.js';error.matchCount=2;
   throw error;
  },
  review:async()=>({approved:true}),test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
  onFeedback:async feedback=>{
   feedback.reason='PRIVATE_CALLBACK_SECRET';
   feedback.stage='PRIVATE_CALLBACK_STAGE';
  }
 });
 await assert.rejects(run,error=>{
  assert.match(error.message,/Repair attempts exhausted: build: Immutable source edit did not match exactly once/);
  assert.ok(!error.message.includes('PRIVATE_UPSTREAM_SECRET'));
  assert.ok(!error.message.includes('PRIVATE_CALLBACK_SECRET'));
  assert.ok(!error.message.includes('PRIVATE_CALLBACK_STAGE'));
  assert.equal(error.sourcePath,'src/page.js');
  assert.equal(error.matchCount,2);
  return true;
 });
});


test('observer callback cannot rewrite source evidence used by the next repair attempt',async()=>{
 let attempts=0;
 const expected={code:'immutable_edit_match_count',sourcePath:'src/page.js',matchCount:2};
 const result=await repairWithFeedback({
  build:async feedback=>{
   if(++attempts===1){
    const error=new Error('PRIVATE_UPSTREAM_SOURCE');
    Object.assign(error,expected);
    throw error;
   }
   assert.equal(feedback.reason,'Immutable source edit did not match exactly once');
   assert.deepEqual(feedback.diagnostic,expected);
   assert.deepEqual(feedback.failures[0].diagnostic,expected);
   assert.equal(feedback.failures.length,1);
   assert.ok(!JSON.stringify(feedback).includes('UNTRUSTED_CALLBACK_SENTINEL'));
   assert.ok(!JSON.stringify(feedback).includes('config/.env'));
   return {safe:true};
  },
  review:async()=>({approved:true}),test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
  onFeedback:async observed=>{
   observed.reason='UNTRUSTED_CALLBACK_SENTINEL';
   observed.diagnostic.sourcePath='config/.env';
   observed.failures[0].diagnostic.sourcePath='config/.env';
   observed.failures.push({stage:'injected',reason:'UNTRUSTED_CALLBACK_SENTINEL'});
  }
 });
 assert.equal(result.attempt,2);
 assert.equal(attempts,2);
});


test('ordinary source-window callback cannot forge a typed immutable terminal receipt',async()=>{
 const run=repairWithFeedback({
  maxAttempts:1,
  build:async()=>{throw Error('ordinary source-window failure')},
  review:async()=>({approved:true}),test:async()=>({passed:true}),
  arbitrate:async()=>({decision:'approve'}),restore:async()=>{},
  onFeedback:async feedback=>{
   // Ordinary callbacks may add a bounded source-window replan for retries,
   // but cannot manufacture a typed immutable editor failure or source path.
   feedback.windowReplan={applied:true};
   feedback.diagnostic={code:'immutable_edit_match_count',sourcePath:'src/forged.js',matchCount:1};
  }
 });
 await assert.rejects(run,error=>{
  assert.match(error.message,/Repair attempts exhausted: build: ordinary source-window failure/);
  assert.ok(!error.message.includes('src/forged.js'));
  assert.equal(error.code,undefined);
  assert.equal(error.sourcePath,undefined);
  return true;
 });
});
