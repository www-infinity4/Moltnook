import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCloudflareSkill, dispatchCloudflareRead } from '../brain/skills/cloudflare-skill-dispatch.mjs';

const now = Date.parse('2026-10-28T19:30:00Z');
const request = { skillId: 'cloudflare.workers.inspect', resourceId: 'worker_123' };
const runner = { jobId: 'job1', leaseId: 'lease1', fence: 2, signed: true, sourceRevision: 'a'.repeat(40), runtimeIdentity: 'bubbles-runtime', leaseStartedAt: '2026-10-28T19:29:00Z', leaseExpiresAt: '2026-10-28T19:33:00Z' };
const evidence = { permissionId: 'perm_1', status: 'verified', skillId: request.skillId, grantedTo: runner.runtimeIdentity, resourceId: request.resourceId, risk: 'read', verifiedAt: '2026-10-28T19:29:00Z', expiresAt: '2026-10-28T19:32:00Z' };
const catalog = { schemaVersion: 1, kind: 'bubbles.cloudflare.skill-catalog', authorization: { allowProductionMutation: false, connectorApiVerification: 'verified', runtimeIdentityVerified: true, verifiedPermissionCount: 403 }, skills: [{ id: request.skillId, risk: 'read' }, { id: 'cloudflare.workers.deploy', risk: 'write', enabled: false }] };
const args = () => ({ catalog: structuredClone(catalog), request: structuredClone(request), runner: structuredClone(runner), evidence: structuredClone(evidence), now });

test('verified signed scoped read produces only a sanitized receipt', async () => {
  let calls = 0;
  const result = await dispatchCloudflareRead({ ...args(), adapter: async input => { calls++; assert.equal(input.permissionId, 'perm_1'); assert.equal(Object.isFrozen(input), true); return { success: true, resourceId: input.resourceId, receiptId: 'cf_read_1', httpStatus: 200, secret: 'never_return' }; } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { state: 'completed', skillId: request.skillId, resourceId: request.resourceId, jobId: 'job1', fence: 2, receiptId: 'cf_read_1', httpStatus: 200 });
});

test('owner-reported permissions alone never authorize a call', async () => {
  const a = args(); a.catalog.authorization.connectorApiVerification = 'blocked_http_401_invalid_api_token'; a.catalog.authorization.runtimeIdentityVerified = false; a.catalog.authorization.verifiedPermissionCount = null;
  let called = false;
  const result = await dispatchCloudflareRead({ ...a, adapter: async () => { called = true; } });
  assert.equal(result.reason, 'cloudflare_connector_unverified'); assert.equal(called, false);
});

test('unsigned, expired and unfenced runner denied', () => {
  for (const bad of [{ signed: false }, { fence: 0 }, { sourceRevision: 'main' }]) {
    const a = args(); Object.assign(a.runner, bad); assert.equal(authorizeCloudflareSkill(a).reason, 'missing_signed_runner');
  }
  for (const bad of [{ leaseExpiresAt: '2026-10-28T19:29:59Z' }, { leaseStartedAt: '2026-10-28T19:10:00Z' }]) {
    const a = args(); Object.assign(a.runner, bad); assert.equal(authorizeCloudflareSkill(a).reason, 'expired_or_invalid_lease');
  }
});

test('permission evidence must match runtime, skill and resource', () => {
  for (const bad of [{ grantedTo: 'someone-else' }, { skillId: 'cloudflare.dns.inspect' }, { resourceId: 'other' }, { risk: 'write' }, { status: 'owner_reported' }, { permissionId: '' }]) {
    const a = args(); Object.assign(a.evidence, bad); assert.equal(authorizeCloudflareSkill(a).reason, 'missing_scoped_permission_evidence');
  }
});

test('stale or expired permission evidence denied', () => {
  for (const bad of [{ verifiedAt: '2026-10-28T19:00:00Z' }, { verifiedAt: '2026-10-28T19:31:00Z' }, { expiresAt: '2026-10-28T19:30:00Z' }]) {
    const a = args(); Object.assign(a.evidence, bad); assert.equal(authorizeCloudflareSkill(a).reason, 'stale_permission_evidence');
  }
});

test('writes and disabled skills cannot run through read dispatcher', async () => {
  for (const skill of [{ id: 'cloudflare.workers.deploy', risk: 'write', enabled: false }, { id: 'cloudflare.workers.inspect', risk: 'write' }]) {
    const a = args(); a.catalog.skills = [skill]; a.request.skillId = skill.id; a.evidence.skillId = skill.id;
    const result = await dispatchCloudflareRead({ ...a, adapter: () => { throw Error('must not run'); } });
    assert.notEqual(result.state, 'completed');
  }
});

test('invalid catalog, duplicate skills and arbitrary resource denied', () => {
  const a = args(); a.catalog.skills.push({ id: request.skillId, risk: 'read' }); assert.equal(authorizeCloudflareSkill(a).reason, 'unknown_or_duplicate_skill');
  const b = args(); b.request.resourceId = '../other'; assert.equal(authorizeCloudflareSkill(b).reason, 'invalid_resource');
  const c = args(); c.catalog.schemaVersion = 999; assert.equal(authorizeCloudflareSkill(c).reason, 'invalid_catalog');
});

test('adapter failures and forged receipts denied without exposing error', async () => {
  const bad = await dispatchCloudflareRead({ ...args(), adapter: async () => ({ success: true, resourceId: 'other', receiptId: 'x', httpStatus: 200 }) });
  assert.equal(bad.reason, 'missing_matching_tool_receipt');
  const failed = await dispatchCloudflareRead({ ...args(), adapter: async () => { throw Error('token=secret'); } });
  assert.deepEqual(failed, { state: 'blocked', reason: 'adapter_execution_failed', skillId: request.skillId });
});
