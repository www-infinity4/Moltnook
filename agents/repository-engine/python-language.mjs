import {execFileSync} from 'node:child_process';

// Lint only: never import or execute the target Python program or its config.
export function lintPython(files,{execute=execFileSync,cwd=process.cwd()}={}){
 if(!Array.isArray(files)||!files.length||files.length>2500||files.some(f=>typeof f!=='string'||!f.endsWith('.py')||f.startsWith('/')||f.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f]/.test(f)))throw Error('bounded_python_paths_required');
 const options={cwd,encoding:'utf8',timeout:90000,maxBuffer:1024*1024,
  env:{PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',CI:'true'}};
 const version=String(execute('ruff',['--version'],options)).trim();
 if(version!=='ruff 0.17.1')throw Error('pinned_ruff_runtime_required');
 // Keep the initial gate focused on syntax, undefined names and invalid flow.
 // Style-only choices must not block existing projects or rewrite owner code.
 const output=execute('ruff',['check','--isolated','--output-format','json','--select','E9,F63,F7,F82','--',...files],options);
 const diagnostics=JSON.parse(String(output));
 if(!Array.isArray(diagnostics)||diagnostics.length)throw Error('python_lint_diagnostics');
 return {tool:'ruff',version,files:files.length,passed:true,sourceExecuted:false};
}
