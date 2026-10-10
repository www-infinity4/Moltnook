// A task opened by a human receives a transparent machine routing note.
import fs from 'node:fs/promises';
import {selectRoute} from './agent-routing.mjs';
const token=process.env.GITHUB_TOKEN;
const file=process.env.GITHUB_EVENT_PATH;
if (!token || !file) throw new Error('GitHub Action context missing.');
const event=JSON.parse(await fs.readFile(file,'utf8'));
const issue=event.issue;
if (!issue || !/^\[Agent Job\]/i.test(issue.title||'')) {
  console.log('Not a Moltnook agent job. Skipping issue routing.');process.exit(0);
}
const repo=process.env.GITHUB_REPOSITORY;
if (repo!=='www-infinity4/Moltnook') throw new Error('Unexpected GitHub repository');
const context=(issue.title+' '+(issue.body||'')).slice(0,6000);
const route=selectRoute(context,'Moltnook');
const roles={
 'gold-diggers-ink':"Gold Digger's Ink",
 'naked-gold-digger':'Naked Gold Digger',
 blueberry:'Blueberry',bluth:'Bluth',
 'orange-julius':'Orange Julius','orange-peel':'Orange Peel',
 greenbeans:'Greenbeans','pink-panther':'Pink Panther',
 'purple-pearl':'Purple Pearl','purple-people-eater':'Purple People Eater'
};
const owner=roles[route.agent],reviewer=roles[route.to];
const url='https://api.github.com/repos/'+repo+'/issues/'+issue.number+'/comments';
const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'User-Agent':'moltnook-agent-router','Content-Type':'application/json'};
const previous=await fetch(url+'?per_page=100',{headers});
if (!previous.ok) throw new Error('Could not check existing routing comments.');
const comments=await previous.json();
const marker='<!-- moltnook-router-v1 -->';
if (comments.some(c=>typeof c.body==='string'&&c.body.includes(marker))) {
  console.log('Already routed.');process.exit(0);
}
const content=[
 marker,'### Moltnook agent dispatch — automated routing (not execution)',
 '**'+owner+' → '+reviewer+'**',
 route.message,
 '',
 '**Proposed handoff**',
 '1. Verify the issue scope, repository and source evidence.',
 '2. Identify existing code paths and dependencies before changes.',
 '3. Use a feature branch, validate behavior, and attach commit/test receipts.',
 '4. Ask for a recorded decision if data is ambiguous. Do not mint tokens or deploy as a side effect of opening an issue.',
 '',
 'Claude-Flow execution: **not started by this comment**. This router makes the job visible to the agent team; an authenticated runner and test receipts are required for implementation.',
 '',
 '[Open the Moltnook agent room](https://www-infinity4.github.io/Moltnook/#agent-floor)'
].join('\n');
const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({body:content})});
if (!response.ok) throw new Error('GitHub comment failed: '+response.status);
console.log('Posted source-linked routing comment for job #'+issue.number);
