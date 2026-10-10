import {test} from 'node:test';import assert from 'node:assert/strict';import {validWalletState} from './wallet-contract.mjs';
test('wallet handshake requires deployed identity, balances and durable history schema',()=>{
 const state={ok:true,user:{id:'fixture'},balances:{STARCOIN:1,QUANT:2,MUSIC_QUANT:3,INFINITY:4},tokens:[],history:[],updatedAt:1};assert.equal(validWalletState(state),true);
 for(const wrong of [{},{...state,ok:false},{...state,user:null},{...state,balances:{...state.balances,QUANT:'2'}},{...state,history:null}])assert.ok(!validWalletState(wrong));
});
