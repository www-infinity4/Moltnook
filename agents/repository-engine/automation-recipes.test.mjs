import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTOMATION_RECIPES, planAutomationRecipe} from './automation-recipes.mjs';
import {selectColorPreface} from './color-task-routing.mjs';
test('all owner domains have reusable recipes rather than a disconnected runner',()=>{
 assert.deepEqual(AUTOMATION_RECIPES.map(x=>x.id),['github','quick-card','creative','media','product','public-research','owner-routine']);
 assert.ok(AUTOMATION_RECIPES.every(x=>x.steps.length>0&&x.provenance==='owner-signed-runner'));
});
test('recipe intake requires stable dedupe and source evidence before execution eligibility',()=>{
 const noId=planAutomationRecipe({recipeId:'github',trigger:'event'});
 assert.equal(noId.status,'blocked');
 const valid=planAutomationRecipe({recipeId:'github',trigger:'event',dedupeKey:'issue:QuantaPhi#1913',sourceUrl:'https://github.com/www-infinity4/QuantaPhi/issues/1913'});
 assert.equal(valid.status,'ready_for_claim');
 assert.equal(valid.executionAuthorized,false);
 assert.equal(valid.approvalGranted,false);
 assert.equal(valid.retry.maxAttempts,3);
 assert.ok(valid.checkpoint.includes('sourceSha'));
});
test('an external effect requires existing independent approval even if input asks to auto-approve',()=>{
 const candidate=planAutomationRecipe({recipeId:'media',trigger:'schedule',dedupeKey:'media-2026-11-11',sourceUrl:'https://example.org/source',autoApprove:true});
 assert.equal(candidate.status,'approval_required');
 assert.equal(candidate.executionAuthorized,false);
 const unknown=planAutomationRecipe({recipeId:'media',trigger:'purchase',dedupeKey:'x',sourceUrl:'https://example.org'});
 assert.equal(unknown.status,'blocked');
});
test('a manual external-effect recipe still requires approval before claim',()=>{
 const plan=planAutomationRecipe({recipeId:'owner-routine',trigger:'manual',dedupeKey:'routine:owner:daily',sourceUrl:'https://example.org/source',autoApprove:true});
 assert.equal(plan.status,'approval_required');
 assert.equal(plan.executionAuthorized,false);
 assert.equal(plan.approvalGranted,false);
});
test('a claimed job can advertise a recipe without granting any new executor permissions',()=>{
 const plan=selectColorPreface({automationRecipe:{recipeId:'quick-card',trigger:'manual',dedupeKey:'issue:1913/card-1',sourceUrl:'https://github.com/www-infinity4/QuantaPhi/issues/1913'}},[]);
 assert.equal(plan.automationPlan.recipeId,'quick-card');
 assert.equal(plan.automationPlan.executionAuthorized,false);
 assert.equal(plan.lane,'investigate');
});
