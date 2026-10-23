import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSource,verifyGeneratedMemoryEngine,reviewSourceDocument,readVerifiedStatus} from './bubbles-memory-lab.mjs';
test('memory lab is fixed static source and permits only its own module import',()=>{
 const app="import {rankMemories} from './context-engine.mjs'; document.addEventListener('click',()=>rankMemories([],''));";
 assert.equal(validateSource('app.mjs',app),app);
 for(const source of ["import {x} from 'elsewhere'; addEventListener; rankMemories",app+"fetch('/private')",app+'process.env.GH_TOKEN',app+'document.cookie'])assert.throws(()=>validateSource('app.mjs',source));
 assert.throws(()=>validateSource('../secrets','x'.repeat(100)));
 assert.throws(()=>validateSource('app.mjs','x'.repeat(8001)));
 const validLong="export function rankMemories(notes,query,aliases={}) { return notes.map(n=>({...n,score:1,reasons:['source']})); }"+'\n// safe elaboration'.repeat(180);
 assert.ok(validLong.length>1500);
 assert.equal(validateSource('context-engine.mjs',validLong),validLong);
 assert.throws(()=>validateSource('context-engine.mjs',validLong+'\n// padding'.repeat(1800)));
});

test('source gate rejects dynamic imports, codegen and exfiltration APIs',()=>{
 for(const payload of [
  "export function rankMemories(){ import('node:fs'); return [] }",
  "export function rankMemories(){ return Function('return process')() }",
  "export function rankMemories(){ new WebSocket('ws:evil'); return [] }",
  "export function rankMemories(){ navigator.sendBeacon('/leak'); return [] }",
  "export function rankMemories(){ globalThis.privateState=true; return [] }",
  "export function rankMemories(){ window['fetch']('/private'); return [] }"
 ])assert.throws(()=>validateSource('context-engine.mjs',payload));
});
test('actual query fixtures gate the generated engine, including timeout behavior',()=>{
 const engine="export function rankMemories(notes,query,aliases={}){\n"+
 " const q=String(aliases[query]||query).toLowerCase().replace('radyo','radio');\n"+
 " if(!q)return notes.map(n=>({...n,score:1,reasons:['recent']}));\n"+
 " const terms=q.split(' ').filter(Boolean);\n"+
 " return notes.map(n=>{\n"+
 "  const score=terms.reduce((s,t)=>s+(n.text.toLowerCase().includes(t)?5:0)+(n.topic.includes(t)?3:0),0);\n"+
 "  return {...n,score,reasons:score?['match']:[]};\n"+
 " }).filter(n=>n.score).sort((a,b)=>b.score-a.score||b.at-a.at);\n}";
 assert.deepEqual(verifyGeneratedMemoryEngine(engine),{cases:5,passed:true});
 const fake=engine.replace("const q=String(aliases[query]||query).toLowerCase().replace('radyo','radio');","const q='';");
 assert.throws(()=>verifyGeneratedMemoryEngine(fake),/generated_engine_/);
 const runaway="export function rankMemories(notes,query,aliases){while(true){} return []}";
 assert.throws(()=>verifyGeneratedMemoryEngine(runaway));
});

test('CSS review excerpts end at complete top-level rules, including nested media and quoted braces',()=>{
 const first='body { content: "}"; color: red; }';
 const nested='@media (width < 700px) { main { display:block; } }';
 const long=first+nested+'\n/* {comment} */\nsection {'+'padding:1px;'.repeat(150)+'}';
 const result=reviewSourceDocument('styles.css',long);
 assert.equal(result.fullReview,false);
 assert.equal(result.reviewSource,first+nested);
 assert.ok(result.reviewSource.length<=1150);
 assert.throws(()=>reviewSourceDocument('styles.css','body {'+'padding:1px;'.repeat(150)+'}'),/css_review_unit_exceeds_budget/);
 const short='body{color:red}';
 assert.deepEqual(reviewSourceDocument('styles.css',short),{fullReview:true,reviewSource:short});
});

test('status identity retry is bounded and never retries consent denials or mutations',async()=>{
 let reads=0,waits=0;
 const rejected=()=>Error('signed_status_http_401_bridge_runner_not_verified');
 const result=await readVerifiedStatus(async()=>{if(++reads===1)throw rejected();return {ok:true};},async ms=>{assert.equal(ms,1000);waits++;});
 assert.deepEqual(result,{ok:true});assert.equal(reads,2);assert.equal(waits,1);
 reads=0;
 await assert.rejects(readVerifiedStatus(async()=>{reads++;throw rejected();},async()=>{}),/bridge_runner_not_verified/);
 assert.equal(reads,2);
 for(const code of ['signed_status_http_403_browser_consent_required','signed_status_http_403_chatgpt_five_day_approval_required','signed_assist_http_401_bridge_runner_not_verified','signed_status_http_500_unclassified_bridge_error']){
  reads=0;
  await assert.rejects(readVerifiedStatus(async()=>{reads++;throw Error(code);},async()=>{assert.fail('must not wait');}),{message:code});
  assert.equal(reads,1);
 }
});
