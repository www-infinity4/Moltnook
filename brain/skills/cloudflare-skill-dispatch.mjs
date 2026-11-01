/**
 * Fail-closed Bubbles Cloudflare skill dispatcher.
 * Source-only adapter: callers must supply a signed runner and a real Cloudflare
 * tool callback. This module neither stores credentials nor creates authority.
 */
const MAX_EVIDENCE_AGE_MS = 15 * 60_000;
const MAX_LEASE_MS = 5 * 60_000;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value)) return NaN;
  return Date.parse(value);
}

function blocked(reason, skillId) {
  return { state: 'blocked', reason, skillId: typeof skillId === 'string' ? skillId : null };
}

export function authorizeCloudflareSkill({ catalog, request, runner, evidence, now = Date.now() }) {
  const skillId = request?.skillId;
  if (!catalog || catalog.schemaVersion !== 1 || catalog.kind !== 'bubbles.cloudflare.skill-catalog' || !Array.isArray(catalog.skills)) return blocked('invalid_catalog', skillId);
  if (typeof skillId !== 'string' || !/^cloudflare\.[a-z0-9.-]+$/.test(skillId)) return blocked('invalid_skill', skillId);
  const matches = catalog.skills.filter(s => s && s.id === skillId);
  if (matches.length !== 1) return blocked('unknown_or_duplicate_skill', skillId);
  const skill = matches[0];
  if (skill.enabled === false) return blocked('skill_disabled', skillId);
  if (skill.risk !== 'read') return blocked('write_requires_separate_reviewed_dispatcher', skillId);
  if (catalog.authorization?.allowProductionMutation !== false) return blocked('unsafe_catalog_policy', skillId);
  // The catalog is itself a security boundary. A malformed or downgraded
  // policy must not silently turn verified read-only skills into permissive ones.
  if (catalog.policy?.noSecretsInCatalog !== true || catalog.policy?.requireLivePermissionCheck !== true || catalog.policy?.requireSignedBrainReceipt !== true || catalog.policy?.requireIndependentSecurityReviewForSensitiveChanges !== true) return blocked('unsafe_catalog_policy', skillId);
  if (catalog.authorization?.connectorApiVerification !== 'verified' || catalog.authorization?.runtimeIdentityVerified !== true || !Number.isInteger(catalog.authorization?.verifiedPermissionCount) || catalog.authorization.verifiedPermissionCount < 1) return blocked('cloudflare_connector_unverified', skillId);
  if (typeof now !== 'number' || !Number.isFinite(now)) return blocked('invalid_clock', skillId);
  if (typeof request?.resourceId !== 'string' || !/^[a-zA-Z0-9_:-]{1,120}$/.test(request.resourceId)) return blocked('invalid_resource', skillId);
  if (typeof runner?.jobId !== 'string' || !runner.jobId || typeof runner?.leaseId !== 'string' || !runner.leaseId || !Number.isSafeInteger(runner.fence) || runner.fence < 1 || typeof runner?.sourceRevision !== 'string' || !/^[a-f0-9]{40}$/.test(runner.sourceRevision) || runner.signed !== true) return blocked('missing_signed_runner', skillId);
  const leaseExpiry = validDate(runner.leaseExpiresAt);
  const leaseStart = validDate(runner.leaseStartedAt);
  if (!Number.isFinite(leaseExpiry) || !Number.isFinite(leaseStart) || leaseStart > now || leaseExpiry <= now || leaseExpiry - leaseStart > MAX_LEASE_MS) return blocked('expired_or_invalid_lease', skillId);
  if (typeof runner.runtimeIdentity !== 'string' || !runner.runtimeIdentity || typeof evidence?.permissionId !== 'string' || !evidence.permissionId || evidence.status !== 'verified' || evidence.skillId !== skillId || evidence.grantedTo !== runner.runtimeIdentity || evidence.resourceId !== request.resourceId || evidence.risk !== 'read') return blocked('missing_scoped_permission_evidence', skillId);
  const checked = validDate(evidence.verifiedAt);
  const expires = validDate(evidence.expiresAt);
  if (!Number.isFinite(checked) || !Number.isFinite(expires) || checked > now || now - checked > MAX_EVIDENCE_AGE_MS || expires <= now) return blocked('stale_permission_evidence', skillId);
  return { state: 'authorized', skillId, resourceId: request.resourceId, jobId: runner.jobId, leaseId: runner.leaseId, fence: runner.fence, permissionId: evidence.permissionId, runtimeIdentity: runner.runtimeIdentity, sourceRevision: runner.sourceRevision };
}

/** A trusted caller must cryptographically validate the signed runner before
 * setting runner.signed=true; this module cannot validate provider credentials.
 * The adapter must enforce the actual Cloudflare API permission/resource scope.
 */
export async function dispatchCloudflareRead({ catalog, request, runner, evidence, adapter, now = Date.now(), clock = Date.now }) {
  const decision = authorizeCloudflareSkill({ catalog, request, runner, evidence, now });
  if (decision.state !== 'authorized') return decision;
  if (typeof adapter !== 'function') return blocked('missing_verified_adapter', decision.skillId);
  if (typeof clock !== 'function') return blocked('invalid_completion_clock', decision.skillId);
  try {
    const receipt = await adapter(Object.freeze({ ...decision }));
    // The adapter can wait on Cloudflare beyond the runner's fenced lease or
    // permission evidence lifetime. Never report a late response as completed.
    // A late operation may still have happened: reconcile its receipt before
    // any retry, rather than dispatching the same operation again.
    const completedAt = clock();
    if (!Number.isFinite(completedAt) || completedAt < now) return blocked('invalid_completion_clock', decision.skillId);
    const finalDecision = authorizeCloudflareSkill({ catalog, request, runner, evidence, now: completedAt });
    if (finalDecision.state !== 'authorized' || finalDecision.skillId !== decision.skillId || finalDecision.resourceId !== decision.resourceId || finalDecision.jobId !== decision.jobId || finalDecision.leaseId !== decision.leaseId || finalDecision.fence !== decision.fence || finalDecision.permissionId !== decision.permissionId || finalDecision.runtimeIdentity !== decision.runtimeIdentity || finalDecision.sourceRevision !== decision.sourceRevision) {
      return blocked('lease_or_permission_changed_during_execution', decision.skillId);
    }
    // Require a receipt scoped to this *exact* job, lease and fence; a
    // previous success on the same Worker/resource is not a completion proof.
    if (receipt?.success !== true || receipt?.skillId !== decision.skillId || receipt?.resourceId !== decision.resourceId || receipt?.jobId !== decision.jobId || receipt?.leaseId !== decision.leaseId || receipt?.fence !== decision.fence || receipt?.permissionId !== decision.permissionId || receipt?.runtimeIdentity !== decision.runtimeIdentity || receipt?.sourceRevision !== decision.sourceRevision || typeof receipt?.receiptId !== 'string' || !/^[a-zA-Z0-9_:-]{1,128}$/.test(receipt.receiptId) || !Number.isInteger(receipt?.httpStatus) || receipt.httpStatus < 200 || receipt.httpStatus >= 300) return blocked('missing_matching_tool_receipt', decision.skillId);
    return { state: 'completed', skillId: decision.skillId, resourceId: decision.resourceId, jobId: decision.jobId, fence: decision.fence, receiptId: receipt.receiptId, httpStatus: receipt.httpStatus };
  } catch {
    return blocked('adapter_execution_failed', decision.skillId);
  }
}
