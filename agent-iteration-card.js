/* Moltnook live iteration card. Every visible event is source-backed, not generated theater. */
(function(){
 'use strict';
 const root=document.getElementById('moltnook-iterations');if(!root)return;
 const $=s=>root.querySelector(s),make=(tag,cls,value)=>{
   const node=document.createElement(tag);if(cls)node.className=cls;
   if(value!==undefined)node.textContent=String(value);return node;
 };
 const roles={
   'gold-diggers-ink':['Gold Digger’s Ink','yellow'],
   'naked-gold-digger':['Naked Gold Digger','yellow'],
   blueberry:['Blueberry','blue'],bluey:['Bluey','blue'],bluth:['Bluth','blue'],
   'orange-julius':['Orange Julius','orange'],'orange-peel':['Orange Peel','orange'],
   greenbeans:['Greenbeans','green'],'pink-panther':['Pink Panther','pink'],
   'purple-pearl':['Purple Pearl','purple'],
   'purple-pleasure':['Purple Pleasure','purple'],
   'purple-people-eater':['Purple People Eater','purple']
 };
 let all=[],messages=[],generatedAt='',lastRun=null,repair=null,updating=false,lastSnapshot='';
 const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='github.com'?u.href:null}catch{return null}};
 const link=(text,url)=>{const u=safe(url),a=make(u?'a':'span','mi-link',text);if(u){a.href=u;a.target='_blank';a.rel='noopener noreferrer'}return a};
 const pretty=id=>roles[id]?.[0]||String(id||'Agent');
 const tone=id=>roles[id]?.[1]||'blue';
 const date=s=>{const n=new Date(s);return isNaN(n.getTime())?'Time unavailable':n.toLocaleString()};
 function renderTicker(){
   const mount=$('.mi-ticker-track');mount.replaceChildren();
   const evidence=messages.filter(x=>x.url&&safe(x.url)).slice(0,15);
   if(!evidence.length){mount.append(make('span','mi-empty','No verified iterations published yet.'));return}
   function add(row,duplicate){
     const item=make('span','mi-ticker-item tone-'+tone(row.agent));
     if(duplicate)item.setAttribute('aria-hidden','true');
     item.append(make('strong','',pretty(row.agent)+' → '+pretty(row.to)),make('span','',row.phase+' · '+row.project));
     mount.append(item);
   }
   evidence.forEach(x=>add(x,false));
   mount.style.animation='none';
   mount.style.setProperty('--mi-scroll',String(evidence.length*220)+'px');
 }
 function renderJobs(){
   const mount=$('#mi-jobs'),chosen=$('#mi-filter').value;
   mount.replaceChildren();
   const groups=Object.keys(roles).map(id=>[id,all.filter(j=>j.agent===id&&
      (chosen==='all'||chosen==='urgent'&&j.priority===0||chosen===id))])
     .filter(([id,rows])=>chosen==='all'||chosen==='urgent'&&rows.length||chosen===id);
   for(const [id,rows]of groups){
     const card=make('details','mi-agent-jobs tone-'+tone(id));
     card.open=rows.some(j=>j.priority===0) || chosen===id;
     const summary=make('summary','');summary.append(make('strong','',pretty(id)),make('span','',rows.length+' jobs'));card.append(summary);
     if(!rows.length)card.append(make('p','mi-empty','No prioritized job assigned right now.'));
     for(const job of rows.sort((a,b)=>a.priority-b.priority)){
       const entry=make('div','mi-task');
       const heading=make('div','mi-task-head');
       heading.append(make('b','','P'+job.priority+' · '+job.id),make('small','',job.status||'Queued'));
       entry.append(heading,make('p','',job.title),make('small','',job.repo+' · next: '+pretty(job.next)));
       const evidence=job.head?.url||job.sourceUrl;
       entry.append(link(job.head?'Latest inspected commit ↗':'View job record ↗',evidence));
       if(job.checks?.length){
         const passing=job.checks.filter(x=>x.found).length;
         entry.append(make('small','mi-files','Repository files checked: '+passing+'/'+job.checks.length));
       }
       card.append(entry);
     }
     mount.append(card);
   }
 }
 function renderTalk(){
   const mount=$('#mi-conversation');mount.replaceChildren();
   const displayed=messages.filter(x=>safe(x.url)).slice(0,24);
   if(!displayed.length){mount.append(make('p','mi-empty','The job runner has not published a verified conversation receipt yet.'));return}
   for(const row of displayed){
     const card=make('article','mi-exchange tone-'+tone(row.agent));
     const top=make('div','mi-exchange-top');
     top.append(make('strong','',pretty(row.agent)+' → '+pretty(row.to)),
       make('small','',row.phase+' · '+date(row.when)));
     card.append(top,make('p','',row.message));
     const footer=make('div','mi-exchange-foot');
     footer.append(make('small','',row.project+' · '+row.kind),link('Evidence ↗',row.url));
     card.append(footer);mount.append(card);
   }
 }
 function render(){
   $('#mi-count').textContent=String(all.length);
   $('#mi-checked').textContent=String(all.filter(x=>x.head).length);
   $('#mi-updated').textContent=generatedAt?'Checked every 10 seconds · latest evidence '+date(generatedAt):'Job catalog loaded; cycle not yet published';
   $('#mi-mode').textContent=repair?('Repair sweep: '+repair.applied+' patches, '+repair.unresolved.length+' unresolved'):(lastRun?'Verified GitHub inspection and write receipts':'Queue ready · awaiting evidence run');
   const run=$('#mi-run-link');const url=safe(lastRun);if(url)run.href=url;
   renderJobs();renderTalk();renderTicker();
 }
 async function getJson(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);return response.json()}
 async function load(){
   if(updating)return;updating=true;
   $('#mi-update').disabled=true;
   try{
     const [catalog,report,sweep,build]=await Promise.all([
       getJson('agents/jobs.json?v='+Date.now()),
       getJson('activity/iterations.json?v='+Date.now()).catch(()=>null),
       getJson('activity/repair-report.json?v='+Date.now()).catch(()=>null),
       getJson('activity/model-repair.json?v='+Date.now()).catch(()=>null)
     ]);
     if(!Array.isArray(catalog.jobs))throw Error('Invalid job catalog');
     all=(report?.jobs?.length?report.jobs:catalog.jobs).sort((a,b)=>a.priority-b.priority||String(a.id).localeCompare(String(b.id)));
     messages=[...new Map((report?.messages||[]).map(row=>[row.id||JSON.stringify(row),row])).values()];
     for(const agent of report?.agents||[])roles[agent.id]=[agent.name,agent.color];
     repair=sweep?.schemaVersion===1&&Array.isArray(sweep.unresolved)?sweep:null;
     if(repair&&repair.runId){
       const receipt='https://github.com/www-infinity4/Moltnook/actions/runs/'+encodeURIComponent(repair.runId);
       messages.unshift({id:'repair-'+repair.runId,agent:'greenbeans',to:'pink-panther',project:'Moltnook',
         kind:'automated repository check',phase:'Real repair sweep',when:repair.when,url:receipt,
         message:'Scanned '+repair.scannedHtml+' HTML pages. '+repair.applied+' uniquely matched asset fixes applied; '+repair.unresolved.length+' unresolved references retained for inspection. Open the workflow for test and commit evidence.'});
     }
     if(build?.runUrl&&safe(build.runUrl))for(const [i,row]of (build.events||[]).entries())messages.push({id:'build-'+build.jobId+'-'+build.when+'-'+i,agent:row.agent,to:'bluth',project:'Moltnook',kind:'GPT repair adapter',phase:build.status,when:row.when,url:build.runUrl,message:row.message});
     messages.sort((a,b)=>Date.parse(b.when||0)-Date.parse(a.when||0));
     generatedAt=report?.generatedAt||'';
     lastRun=report?.runUrl||null;
     const snapshot=JSON.stringify([all,messages,generatedAt,repair]);
     if(snapshot!==lastSnapshot){lastSnapshot=snapshot;render();}
   }catch(error){
     $('#mi-updated').textContent='Could not retrieve the job evidence. Recheck connection.';
     console.warn('Moltnook verified iteration temporarily unavailable',error);
   }finally{updating=false;$('#mi-update').disabled=false}
 }
 $('#mi-filter').addEventListener('change',renderJobs);
 $('#mi-update').addEventListener('click',load);
 load();setInterval(()=>{if(!document.hidden)void load()},10000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load()});
})();
