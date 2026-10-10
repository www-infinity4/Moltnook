import fs from 'node:fs/promises';
import path from 'node:path';
import {PROJECTS,routeEvent} from './agent-routing.mjs';

const owner = 'www-infinity4';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers = {
  'Accept':'application/vnd.github+json',
  'User-Agent':'moltnook-source-linked-agent-feed/1.0',
  ...(token ? {'Authorization':'Bearer ' + token} : {})
};
async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),15000);
  try {
    const response = await fetch(url,{headers,signal:controller.signal});
    if (!response.ok) throw new Error(String(response.status) + ' ' + url);
    return response.json();
  } finally {clearTimeout(timer);}
}
const events = [];
const failures = [];
await Promise.all(PROJECTS.map(async project=>{
  const base = 'https://api.github.com/repos/' + owner + '/' + encodeURIComponent(project);
  const [commits,issues] = await Promise.allSettled([
    get(base + '/commits?per_page=7'),get(base + '/issues?state=all&sort=updated&per_page=9')
  ]);
  if (commits.status==='fulfilled' && Array.isArray(commits.value)) {
    for (const c of commits.value) {
      if (!c.sha || !c.html_url || !c.commit) continue;
      events.push({id:project+'-commit-'+c.sha,project,kind:'commit',
        title:c.commit.message?.split('\n')[0]||'Untitled commit',
        when:c.commit.committer?.date||c.commit.author?.date||new Date(0).toISOString(),
        url:c.html_url,state:'observed'});
    }
  } else failures.push(project + ': commits unavailable');
  if (issues.status==='fulfilled' && Array.isArray(issues.value)) {
    for (const issue of issues.value) {
      if (!issue.html_url || !issue.id) continue;
      const pr = Boolean(issue.pull_request);
      events.push({id:project+'-'+(pr?'PR':'issue')+'-'+issue.number,project,kind:pr?'PR':'issue',
        title:issue.title||'Untitled issue',when:issue.updated_at||issue.created_at,
        url:issue.html_url,state:issue.state});
    }
  } else failures.push(project + ': issues unavailable');
}));
if (!events.length) throw new Error('No GitHub data verified; retaining prior feed.');
const items = events
  .filter(x=>Number.isFinite(Date.parse(x.when)))
  .sort((a,b)=>Date.parse(b.when)-Date.parse(a.when))
  .slice(0,75)
  .map(routeEvent);
const out = {
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  source:'public GitHub issue, pull request and commit metadata',
  status:'automated evidence-bound handoffs; NOT proof of task execution',
  projects:PROJECTS,failures,items
};
const target=path.resolve('activity/feed.json');
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(target,JSON.stringify(out,null,2)+'\n','utf8');
console.log('Wrote ' + items.length + ' source-linked routing notes from ' + new Set(events.map(e=>e.project)).size + ' repositories.');
if (failures.length) console.warn('Partial provider coverage: ' + failures.join('; '));
