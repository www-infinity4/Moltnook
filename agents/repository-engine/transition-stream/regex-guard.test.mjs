import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightRegexSpec} from './regex-guard.mjs';
test('reject broken regex without executing it or sending Copilot a false pass',()=>{
  assert.deepEqual(preflightRegexSpec({pattern:'[',flags:'i'}),{passed:false,rule:'regex.syntax_error'});
  assert.deepEqual(preflightRegexSpec({pattern:'ok',flags:'gg'}),{passed:false,rule:'regex.invalid_bounds_or_flags'});
  assert.deepEqual(preflightRegexSpec({pattern:'(a+)+',flags:''}),{passed:false,rule:'regex.possible_catastrophic_backtracking'});
  assert.deepEqual(preflightRegexSpec({pattern:'a+',flags:'i'}),{passed:true,rule:'regex.syntax_valid',assurance:'syntax_only'});
});
