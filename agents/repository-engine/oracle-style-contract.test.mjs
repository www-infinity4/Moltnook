import test from 'node:test';
import assert from 'node:assert/strict';
import {contrast,validateOracleCssEdit,validateStyleDictionary,styleDictionary} from './oracle-style-contract.mjs';
test('Oracle daylight dictionary has WCAG readable buttons and exact accepted card structures',()=>{
 assert.equal(validateStyleDictionary(),true);
 assert.ok(contrast('#ffffff','#b83b32')>5.65);
 assert.ok(contrast(styleDictionary.colors.ink,styleDictionary.colors.paper)>10);
 assert.ok(styleDictionary.componentVault['oracle-card'].slots.includes('actions'));
 assert.ok(styleDictionary.componentVault['oracle-receipt'].required.includes('transactionId'));
});
test('legacy dark themes, :has, protected controls and illegible cards fail closed',()=>{
 for(const css of ['body:has(.menu){color:#fff}','html{color-scheme:dark}','body{background:#030613}', '.wallet-card{display:none!important}','h2{background:#ffffff;color:#eeeeee}']){
  assert.throws(()=>validateOracleCssEdit('new.css',css),/Oracle|Protected/);
 }
 assert.equal(validateOracleCssEdit('cards.css','.oracle-card { color:#312722; background:#f7f4f0; min-height:44px; }').checked,true);
});
