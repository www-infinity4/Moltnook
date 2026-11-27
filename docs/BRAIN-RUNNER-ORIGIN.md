# Brain runner origin · QuantaPhi #1907 / #2110

The existing signed engineer and credential bridge now resolve a single HTTPS
origin from `BRAIN_RUNNER_ORIGIN`. The repository-engine workflow supplies it
from the repository variable with the same name. An absent/empty variable keeps
`https://infinity-brain-clock.marvaseater.workers.dev`.

This is inactive migration plumbing. No variable, owner grant, credential,
workflow identity, claim, deployment or DNS record is changed by adding it.
The existing OIDC issuer, audience, workflow/repository IDs, main-ref policies,
runner execution context and lease requirements remain authoritative.

Configure a replacement only after the existing Brain source, consistent
private SQLite queue and durable state, original model adapter, TLS endpoint,
old-writer fence and rollback have been verified. See QuantaPhi's
`distributed-vault/SQLITE-BRAIN.md`. A GitHub runner cannot reach the phone's
`127.0.0.1`; a verified owner-controlled HTTPS route is required.

Credential connection, runner operations and receipts must use the same
authority. There is no automatic failover after 503 or an ambiguous claim.
Redirects, embedded URL credentials, cleartext HTTP, path prefixes, query strings
and fragments are rejected. Existing secrets stay in their existing private
server/Actions configuration and must never be placed in the origin variable.

Validation: `node --test agents/repository-engine/credential-bridge.test.mjs
agents/repository-engine/runner-oidc-bridge.test.mjs`. Synthetic configured-host
tests verify original OIDC and a single non-replayed POST without contacting
Cloudflare. Source tests do not prove a live replacement host or engineering run.
