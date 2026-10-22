// Fixed, consent-gated Bubbles project build: informational biological computing research.
// No user-controlled shell, biology lab instructions, account secrets or broad target selection.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const REPO='www-infinity4/Organic-Computation';
const GATEWAY='https://bubbles-cloud-browser.marvaseater.workers.dev/v1/browser/chatgpt/runner';
const DARPA=[
 ['O-Circuit','https://www.darpa.mil/events/2026/o-circuit-proposers-day'],
 ['Molecular Informatics','https://www.darpa.mil/research/programs/molecular-informatics'],
 ['Living Foundries','https://www.darpa.mil/research/programs/living-foundries']
];
export function validateNotes(input){
 const raw=String(input||'').trim();
 if(raw.length<100||raw.length>10000)throw Error('bubbles_research_length_invalid');
 if(/<\s*(script|iframe|object|embed)|\b(?:api[_ -]?key|bearer|github_pat_|ghp_|sk-)\b/i.test(raw))throw Error('unsafe_research_content');
 return raw.replace(/\r/g,'').replace(/\u0000/g,'').slice(0,7000);
}
export function filesForResearch(notes){
 const readme=`# Organic Computation

A research and software-simulation project prepared through the Bubbles AI signed research-and-build pipeline. The repository studies neural-tissue computing, molecular information processing, energy measurement, and ethical issues — not a working biological processor.

## Scientific anchor
- DARPA's **O-Circuit** (2026) explores neural-tissue-driven biological processing units for low-energy learning and inference. This is a research **goal**, not proof of a practical replacement for silicon. [DARPA O-Circuit](https://www.darpa.mil/events/2026/o-circuit-proposers-day)
- DARPA's completed **Molecular Informatics** program studied molecular approaches to encode and process information. [Program page](https://www.darpa.mil/research/programs/molecular-informatics)
- DARPA **Living Foundries** studies programmable metabolic processes for biomanufacturing, a related but distinct field. [Program page](https://www.darpa.mil/research/programs/living-foundries)

## Workstreams
1. Literature and evidence: distinguish results, plans, proposals, and simulations.
2. Software-only experiments: associative memory and noisy inputs with standard Python.
3. Measurement model: learning accuracy, repeatability, response latency, and total system energy including support equipment.
4. Ethics: donor consent, biological safety, oversight and uncertainty about sentience.
5. Theories: a separate, clearly speculative track for user-proposed hydrogen/electron/energy connections, with explicit falsifiable predictions and tests.

## Run
    python3 simulations/associative_memory.py
    python3 -m unittest discover -s tests

Nothing in this repository grows biological tissue, enables drone control, supplies wet-lab protocols, or establishes a commercial product. No DARPA affiliation or funding is claimed.

Start with [research overview](research/overview.md), [Bubbles preliminary notes](research/bubbles-analysis.md), [hypotheses](research/hypotheses.md), and [sources](research/sources.json).
`;
 const overview=`# Research overview

## What is established?
Biological networks process information, and DARPA has formally solicited research into neural-tissue-driven learning and inference in the 2026 O-Circuit program. Such programs define technical ambitions, not proof that an organoid has human-like intelligence or a general-purpose computing advantage.

## What remains uncertain?
Energy budgets depend on sensing, interfaces, perfusion and maintenance, data conversion, and supporting hardware. Robust programming, reliable learning, reproducibility, ethics and long-term stability remain important obstacles. Comparisons must use end-to-end measurements, not isolated estimates of cell power.

## Development approach
Build only mathematical and digital analogues first. Define a specific task, benchmark the same task on a conventional baseline, repeat randomized trials, and publish methodology and negative results. Keep hypothetical biophysical connections separate from source-backed findings.

## Source distinctions
O-Circuit directly concerns neural tissue computing. Molecular Informatics concerns molecule-based information encoding and processing. Living Foundries is programmable biology for synthesis, not equivalent to a wetware CPU.
`;
 const hypotheses=`# Hypotheses and evaluation

| Hypothesis | Evidence classification | Falsifiable measurement |
| --- | --- | --- |
| A trained recurrent network can retrieve corrupted patterns | Software model; reproducible here | Recall accuracy over fixed seeds and noise levels |
| Learning may trade energy for data efficiency in biological architectures | Research question; unverified for any specific design | Full system joules per correct task result against a matched baseline |
| Molecular states could encode or transform information | DARPA program topic; not a validated general-purpose device | Demonstrated state capacity, transition error, latency, repeatability |
| Hydrogen/electron-doorway models could connect to information transport | User hypothesis; not supported by cited DARPA programs | Specify equations, mechanisms, disconfirming observations, independent replication |

**Integrity rule:** Do not describe the last row as a DARPA finding or experimentally demonstrated time travel. Do not equate a software simulation with tissue behavior.
`;
 const sim=`"""Simple software-only associative memory. No biological materials or external packages."""
from __future__ import annotations
import random

PATTERNS = ((1, 1, -1, -1, 1, -1), (-1, 1, -1, 1, -1, 1))

def train(patterns=PATTERNS):
    size = len(patterns[0])
    if not patterns or any(len(p) != size or any(v not in (-1, 1) for v in p) for p in patterns):
        raise ValueError("Binary, equally sized patterns required")
    return [[0 if i == j else sum(p[i] * p[j] for p in patterns)
             for j in range(size)] for i in range(size)]

def recall(state, weights, rounds=12):
    state = list(state)
    for _ in range(rounds):
        previous = state[:]
        for i, row in enumerate(weights):
            score = sum(w * x for w, x in zip(row, state))
            if score != 0:
                state[i] = 1 if score > 0 else -1
        if state == previous:
            break
    return tuple(state)

def experiment(seed=111, flips=1, trials=100):
    rng = random.Random(seed)
    weights = train()
    success = 0
    for _ in range(trials):
        target = rng.choice(PATTERNS)
        state = list(target)
        for index in rng.sample(range(len(state)), flips):
            state[index] *= -1
        success += recall(state, weights) == target
    return success / trials

if __name__ == "__main__":
    for flipped in (0, 1, 2):
        print(f"noise flips={flipped}: recall accuracy={experiment(flips=flipped):.3f}")
`;
 const tests=`import unittest
from simulations.associative_memory import PATTERNS, train, recall, experiment

class SimulationTests(unittest.TestCase):
    def test_diagonal_zero(self):
        weights = train()
        self.assertTrue(all(weights[i][i] == 0 for i in range(len(weights))))
    def test_patterns_stable(self):
        weights = train()
        for pattern in PATTERNS:
            self.assertEqual(recall(pattern, weights), pattern)
    def test_reproducible(self):
        self.assertEqual(experiment(seed=22), experiment(seed=22))
    def test_accuracy_range(self):
        self.assertGreaterEqual(experiment(), 0)
        self.assertLessEqual(experiment(), 1)

if __name__ == "__main__":
    unittest.main()
`;
 const preliminary=`# Bubbles preliminary research response

**Provenance:** Generated by Bubbles through the existing signed server conversation, if its live result passed authentication and receipt checks. Treat as an unverified draft; verify all claims against primary sources.

${notes}

## Research controls
This is not a scientific review, real wet-lab experiment, or grant award. Source pages are curated independently in sources.json.
`;
 const sources={checkedDate:"2026-10-22",sources:DARPA.map(([title,url])=>({title,url,provider:"DARPA",evidenceType:title==="O-Circuit"?"program description / 2026 solicitation":"program page"}))};
 return {"README.md":readme,"research/overview.md":overview,"research/hypotheses.md":hypotheses,"research/bubbles-analysis.md":preliminary,"research/sources.json":JSON.stringify(sources,null,2)+"\n","simulations/__init__.py":"","simulations/associative_memory.py":sim,"tests/test_associative_memory.py":tests,".gitignore":"__pycache__/\n*.pyc\n"};
}
function command(bin,args,{cwd,secret=false}={}){
 const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',GH_PROMPT_DISABLED:'1',...(secret?{GH_TOKEN:process.env.REPOSITORY_WRITE_TOKEN}:{})};
 try{return execFileSync(bin,args,{cwd,env,encoding:'utf8',timeout:45000,stdio:['ignore','pipe','pipe']}).trim();}
 catch(error){const status=/HTTP (\d{3})/.exec(String(error.stderr||''))?.[1];throw Error('executor_'+bin+'_'+(status||error.status||'unavailable'));}
}
function gh(path,method='GET',body){
 const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',GH_PROMPT_DISABLED:'1',GH_TOKEN:process.env.REPOSITORY_WRITE_TOKEN};
 return JSON.parse(execFileSync('gh',['api',path,'--method',method,...(body?['--input','-']:[])],{env,input:body?JSON.stringify(body):undefined,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:45000}).trim()||'null');
}
async function signed(body){
 const u=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);u.searchParams.set('audience','bubbles-owner-message-bridge');
 const res=await fetch(u,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('signed_identity_unavailable');
 const token=(await res.json()).value;
 if(!token)throw Error('signed_identity_missing');
 const r=await fetch(GATEWAY,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.ok!==true||data.jobId!=='chatgpt_runner_'+process.env.GITHUB_RUN_ID)throw Error('signed_'+body.operation+'_not_approved');
 return data;
}
export async function main(){
 const report={repository:REPO,status:'started',runId:process.env.GITHUB_RUN_ID,claimDarpaAffiliation:false};
 const dir=mkdtempSync(join(tmpdir(),'organic-computation-'));
 try{
  if(!process.env.REPOSITORY_WRITE_TOKEN)throw Error('github_runner_secret_missing');
  await signed({operation:'status'});
  const prompt='Bubbles: prepare a scientifically careful, brief research overview of DARPA O-Circuit 2026 neural tissue computing and Molecular Informatics. Explain learning, memory, energy measurement, engineering challenges, and ethics. Distinguish actual results from DARPA goals and avoid inventing data or references. Make no claim of DARPA partnership. Include a paragraph identifying the owner\'s hydrogen/electron-doorway idea as an unvalidated separate hypothesis. Do not provide biological laboratory procedures or military applications.';
  await signed({operation:'assist',turn:0,text:prompt});
  const finished=await signed({operation:'result',turn:0});
  if(finished.state!=='complete'||finished.result?.ok!==true||finished.result.receipt?.status!=='complete')throw Error('bubbles_research_not_completed');
  const notes=validateNotes(finished.result.output);
  const files=filesForResearch(notes);
  for(const [path,content] of Object.entries(files)){
   const dirpath=path.split('/').slice(0,-1).join('/');
   if(dirpath)mkdirSync(join(dir,dirpath),{recursive:true});
   writeFileSync(join(dir,path),content);
  }
  command('python3',['-m','unittest','discover','-s','tests'],{cwd:dir});
  command('python3',['simulations/associative_memory.py'],{cwd:dir});
  const owner=gh('user');
  if(owner.login!=='www-infinity4')throw Error('owner_mismatch');
  await signed({operation:'status'});
  // Never modify an existing repository through this one-use project creation workflow.
  let existing=false;
  try{gh('repos/'+REPO);existing=true;}catch(e){if(!/404/.test(String(e.message)))throw Error('repo_lookup_unverified');}
  if(existing)throw Error('repository_already_exists_review_manually');
  const created=gh('user/repos','POST',{name:'Organic-Computation',description:'Bubbles AI research and software-only prototypes for biological computation',private:false,auto_init:true});
  if(created.full_name!==REPO||created.private!==false)throw Error('repository_identity_not_verified');
  const ref=gh('repos/'+REPO+'/git/ref/heads/'+created.default_branch);
  const base=ref.object.sha,commit=gh('repos/'+REPO+'/git/commits/'+base);
  const tree=gh('repos/'+REPO+'/git/trees','POST',{base_tree:commit.tree.sha,tree:Object.entries(files).map(([path,content])=>({path,content,mode:'100644',type:'blob'}))});
  await signed({operation:'status'});
  const next=gh('repos/'+REPO+'/git/commits','POST',{message:'Create reviewed Bubbles organic computation research project',tree:tree.sha,parents:[base]});
  gh('repos/'+REPO+'/git/refs/heads/'+created.default_branch,'PATCH',{sha:next.sha,force:false});
  const readback=gh('repos/'+REPO+'/git/ref/heads/'+created.default_branch);
  if(readback.object.sha!==next.sha)throw Error('repository_commit_readback_failed');
  report.status='repository_committed';report.commit=next.sha;report.url='https://github.com/'+REPO;report.bubblesResponseReceived=true;report.pythonTestsPassed=true;
 }catch(e){report.status='blocked';report.error=String(e.message).replace(/[^a-zA-Z0-9_]/g,'_').slice(0,90);process.exitCode=1;}
 finally{rmSync(dir,{recursive:true,force:true});mkdirSync('repository-receipts',{recursive:true});writeFileSync('repository-receipts/organic-computation.json',JSON.stringify(report,null,2)+'\n');console.log('BUBBLES_ORGANIC_RESULT '+JSON.stringify(report));}
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
