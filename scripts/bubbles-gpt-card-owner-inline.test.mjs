import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('signed GPT/Card owner handoff compiles before an authorized Brain run',()=>{
 const source=readFileSync(new URL('../.github/workflows/bubbles-owner-message.yml',import.meta.url),'utf8');
 const job=source.split('\n  gpt_card_qa_owner_handoff:')[1];
 assert.ok(job,'named task must remain defined');
 const start=job.indexOf("node --input-type=module <<'NODE'");
 assert.ok(start>=0,'inline signed handler exists');
 const script=job.slice(start+"node --input-type=module <<'NODE'".length,job.indexOf('\n          NODE',start));
 assert.ok(script.includes('GPT_CARDS_BRAIN_INTAKE'));
 assert.ok(script.includes("completed===false"));
 assert.ok(script.includes("operation:'status'"));
 const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:script,encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr||result.error?.message||'Syntax validation failed');
});
