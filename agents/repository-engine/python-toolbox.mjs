// Credential-free Code Phi / Robot Brain Python checkout inspection.
// GitHub Actions supplies a fresh clone; this program never writes to the source repository.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {lintPython} from './python-language.mjs';

export function validateRepository(value){
 if(typeof value!=='string'||!/^www-infinity4\/[A-Za-z0-9_.-]+$/.test(value))throw Error('Repository outside owner scope');
 return value;
}
export function validateRef(value){
 if(typeof value!=='string'||!/^[a-f0-9]{40}$/.test(value))throw Error('An immutable 40-character commit SHA is required');
 return value;
}
export function validateLock(text){
 if(Buffer.byteLength(text,'utf8')>12000)throw Error('Toolbox lock file too large');
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
 if(lines.length>35)throw Error('Too many pinned dependencies');
 for(const line of lines){
  // No VCS, editable installs, transitive unpinned dependencies, flags, or remote files.
  if(!/^[A-Za-z0-9_.-]+==[A-Za-z0-9_.!+~-]+\s+--hash=sha256:[a-fA-F0-9]{64}$/.test(line))
   throw Error('Each Python package must have an exact version and SHA-256 wheel hash');
 }
 return lines;
}
export async function inspectPythonCheckout({root=process.cwd(),output='repository-receipts/python-toolbox.json',execute=execFileSync}={}){
 const run=(cmd,args,options={})=>execute(cmd,args,{cwd:root,encoding:'utf8',timeout:180000,
  maxBuffer:1024*1024,env:{PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',CI:'true',...options.env}});
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),repository:process.env.TARGET_REPOSITORY||null,
  sourceSha:process.env.TARGET_SHA||null,mode:'unprivileged_readonly_checkout',packages:'standard_library',checks:[],passed:false};
 const check=(name,cmd,args)=>{try{const output=run(cmd,args);report.checks.push({name,passed:true,output:String(output).slice(-900)});}
  catch(e){report.checks.push({name,passed:false,error:String(e.stderr||e.stdout||e.message).slice(-900)});}};
 try{
  const files=String(run('git',['ls-files','--cached','--','*.py','**/*.py'])).split(/\r?\n/).filter(Boolean)
   .filter(f=>!f.startsWith('.venv/')&&!f.startsWith('node_modules/'));
  if(files.length>2500)throw Error('Python source scan exceeds bounded file limit');
  if(!files.length){report.checks.push({name:'Python sources',passed:true,output:'No tracked Python files; toolbox idle'});}
  else{
   for(const f of files){const absolute=path.resolve(root,f);
    if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Python source path escapes checkout');
    if((await fs.lstat(absolute)).isSymbolicLink())throw Error('Python source symlink rejected');
   }
   const venv=path.join(await fs.mkdtemp(path.join(os.tmpdir(),'phi-python-')),'venv');
   check('Create isolated Python virtual environment','python3',['-m','venv',venv]);
   let python=path.join(venv,'bin','python');
   const lock=path.join(root,'requirements-toolbox.lock');
   let pins=[];
   try{const stat=await fs.lstat(lock);if(stat.isSymbolicLink())throw Error('Toolbox dependency lock symlink rejected');
    pins=validateLock(await fs.readFile(lock,'utf8'));
   }catch(e){if(e.code!=='ENOENT')throw e;}
   if(pins.length){
    report.packages='exact_hash_pinned_wheels';
    check('Install hash-pinned Python wheels (no source builds)',python,
      ['-m','pip','install','--disable-pip-version-check','--no-deps','--require-hashes','--only-binary=:all:','-r',lock]);
   }
   check('Python AST compilation',python,['-B','-c',
    'import ast,sys;[ast.parse(open(x,encoding="utf8").read(),filename=x) for x in sys.argv[1:]]',...files]);
   try{report.checks.push({name:'Pinned Ruff Python correctness checks',...lintPython(files,{cwd:root,execute})});}
   catch(error){report.checks.push({name:'Pinned Ruff Python correctness checks',passed:false,error:String(error.stderr||error.stdout||error.message).slice(-900)});}
   const testPaths=files.filter(f=>/(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(f));
   if(testPaths.length)check('Discovered Python unit tests',python,['-B','-m','unittest','discover','-s','.','-p','test_*.py']);
   else report.checks.push({name:'Python test discovery',passed:true,output:'No tracked test_*.py; AST compilation only, behavior not verified'});
  }
  report.passed=report.checks.every(c=>c.passed);
 }catch(error){report.checks.push({name:'Toolbox policy',passed:false,error:String(error.message).slice(0,900)})}
 await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
 await fs.writeFile(output,JSON.stringify(report,null,2));
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await inspectPythonCheckout();
 console.log(JSON.stringify({passed:report.passed,sourceSha:report.sourceSha,checks:report.checks.map(({name,passed})=>({name,passed}))}));
 if(!report.passed)process.exitCode=1;
}
