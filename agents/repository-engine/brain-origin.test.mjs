import test from 'node:test';
import assert from 'node:assert/strict';
import {brainRunnerOrigin} from './brain-origin.mjs';

test('existing Brain remains the default and owner host selection is explicit',()=>{
 assert.equal(brainRunnerOrigin({}),'https://infinity-brain-clock.marvaseater.workers.dev');
 assert.equal(brainRunnerOrigin({BRAIN_RUNNER_ORIGIN:'https://brain.example.org/'}),'https://brain.example.org');
});
test('runner origin rejects credentials, cleartext, paths and redirect-style confusion',()=>{
 for(const value of ['http://brain.example.org','https://user:pass@brain.example.org','https://brain.example.org/runner','https://brain.example.org/?token=secret','https://brain.example.org/#x','not a URL','https://brain.example.org\\other']){
  assert.throws(()=>brainRunnerOrigin({BRAIN_RUNNER_ORIGIN:value}),/brain_runner_origin_invalid/);
 }
});
