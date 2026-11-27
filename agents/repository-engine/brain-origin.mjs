// Explicit owner configuration, fixed for the whole workflow. Never fail over
// after an uncertain claim: separate authorities could execute the same job.
export function brainRunnerOrigin(env=process.env){
 const value=env.BRAIN_RUNNER_ORIGIN||'https://infinity-brain-clock.marvaseater.workers.dev';
 let url;
 try{url=new URL(value);}catch{throw Error('brain_runner_origin_invalid');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||/[\\\s]/.test(value))
  throw Error('brain_runner_origin_invalid');
 return url.origin;
}
