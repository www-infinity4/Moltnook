import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveTickets,createMissingTickets} from './auto-ticket-sweep.mjs';
const now=Date.now();
const snapshot={generatedAt:new Date(now).toISOString(),runUrl:'https://github.com/www-infinity4/Moltnook/actions/runs/2',jobs:[
 {id:'JOB-1',repo:'QuantaPhi',head:{sha:'a'.repeat(40),url:'https://github.com/www-infinity4/QuantaPhi/commit/a'},checks:[{path:'broken.js',found:false}],ci:{status:'success'}},
 {id:'JOB-2',repo:'QuantaPhi',head:{sha:'a'.repeat(40),url:'https://github.com/www-infinity4/QuantaPhi/commit/a'},checks:[{path:'broken-again.js',found:false}],ci:{status:'success'}},
 {id:'JOB-3',repo:'Moltnook',head:{sha:'b'.repeat(40)},checks:[],ci:{status:'failure',url:'https://github.com/www-infinity4/Moltnook/actions/runs/42',name:'engine'}}
]};
test('observed missing paths and failed CI produce one ticket per repo/failure class',()=>{
 const rows=deriveTickets(snapshot,{now});
 assert.equal(rows.length,2);
 assert.match(rows[0].body,/broken.js/);
 assert.match(rows[1].body,/42/);
 assert.ok(rows.every(row=>row.title.startsWith('[Agent Job]')));
});
test('no stale or unsupported reports make tickets',()=>{
 assert.throws(()=>deriveTickets({...snapshot,generatedAt:'2022-01-01T00:00:00Z'},{now}),/stale/);
 assert.deepEqual(deriveTickets({...snapshot,jobs:[{id:'X',repo:'QuantaPhi',checks:[],ci:{status:'success'}}]},{now}),[]);
});
test('deduplication requires a confirmed issue receipt and obeys limits',async()=>{
 const rows=deriveTickets(snapshot,{now});const called=[];
 const made=await createMissingTickets({tickets:[...rows,...rows],existingTitles:new Set(),maxNew:2,
  create:async ticket=>{called.push(ticket.title);return {number:called.length,html_url:'https://github.com/www-infinity4/Oracle-Octaves/issues/'+called.length}}});
 assert.equal(made.length,2);assert.equal(called.length,2);
 await assert.rejects(createMissingTickets({tickets:rows,existingTitles:new Set(),create:async()=>({})}),/receipt/);
});
