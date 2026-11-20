import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {edgePreflight,preflightExitCode} from './repair-finalize-edge-preflight.mjs';
import {expectedEdgeVersion} from './repair-finalize-edge.mjs';

function response(status,edge){
 return {ok:status>=200&&status<300,status,headers:{get:name=>name==='x-quantaphi-edge'?edge:null}};
}
test('a different deployed edge is deferred on scheduled runs, never called verified',async()=>{
 let called=0;
 const got=await edgePreflight({mode:'scheduled',fetchImpl:async()=>{
  called++;return response(200,'quantaphi-org-service-20261029-housing-v15');
 }});
 assert.equal(called,1);
 assert.equal(got.status,'deferred_edge_version_drift');
 assert.equal(got.observedEdgeVersion,'quantaphi-org-service-20261029-housing-v15');
 assert.equal(got.expectedEdgeVersion,expectedEdgeVersion);
 assert.equal(got.ready,false);
 assert.equal(got.deploymentVerified,false);
 assert.equal(got.mergeAttempted,false);
 assert.equal(preflightExitCode(got,'scheduled'),0);
 assert.equal(preflightExitCode(got,'apply'),1);
});
test('matching header permits full exact-content browser verification, but is not itself deployment acceptance',async()=>{
 const got=await edgePreflight({mode:'scheduled',fetchImpl:async()=>response(200,expectedEdgeVersion)});
 assert.equal(got.status,'compatible_header_only');
 assert.equal(got.ready,true);
 assert.equal(got.deploymentVerified,false);
 assert.equal(preflightExitCode(got,'scheduled'),0);
});
test('HTTP errors and unavailable edge cannot silently produce a green scheduled run',async()=>{
 const bad=await edgePreflight({mode:'scheduled',fetchImpl:async()=>response(503,expectedEdgeVersion)});
 assert.equal(bad.ready,false);
 assert.equal(preflightExitCode(bad,'scheduled'),1);
 const missing=await edgePreflight({mode:'scheduled',fetchImpl:async()=>{throw Error('offline')}});
 assert.equal(missing.ready,false);
 assert.equal(missing.status,'preflight_request_failed');
 assert.equal(preflightExitCode(missing,'scheduled'),1);
});
test('scheduler guards write token and merge steps behind the edge preflight',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/browser-repair-finalize.yml',import.meta.url),'utf8');
 const start=workflow.indexOf('id: edge-preflight'),token=workflow.indexOf('Mint repository-scoped repair token'),apply=workflow.indexOf('Prepare review, merge approved patch and verify deployed source');
 assert.ok(start>=0 && start<token && token<apply,'edge preflight must execute before any repair writer');
 assert.match(workflow,/if: steps\.edge-preflight\.outputs\.ready == 'true'/);
 assert.match(workflow,/run: node scripts\/repair-finalize-edge-preflight\.mjs/);
});
