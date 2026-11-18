# Bubbles Cloudflare operations knowledge — permission-aware training

Owner reported granting **386 Cloudflare permissions** on 2026-10-28. **This count and the exact effective permission inventory are not yet verified.** A grant to an account, connector or token is not automatically a grant to Bubbles' runtime identity. Never infer scopes from the number alone.

## Canonical documentation sources (retrieve latest at task time)

- API permission groups and scopes: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- API token policy and creation: https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/
- Account-owned token restrictions: https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/
- Workers runtime and bindings: https://developers.cloudflare.com/workers/
- Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- D1 database: https://developers.cloudflare.com/d1/
- R2 storage: https://developers.cloudflare.com/r2/
- KV: https://developers.cloudflare.com/kv/
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- Queues: https://developers.cloudflare.com/queues/
- Cloudflare Access application tokens: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
- Cloudflare GraphQL analytics: https://developers.cloudflare.com/analytics/graphql-api/
- API reference: https://developers.cloudflare.com/api/

Use the live Cloudflare documentation search and API schema before planning an operation; Cloudflare endpoint signatures, scope names and limits can change. Do not bulk-copy every page into prompts. Index URLs, product tags, retrieval timestamps, summaries and safe example requests; fetch the relevant page on demand.

## Permission-to-skill record

For **each effective permission** create one evidence-backed row, keyed by Cloudflare's stable permission ID (not a guessed name):

```json
{
  "permissionId": "from authorized permission inventory",
  "name": "Cloudflare display name",
  "scope": "account|zone|user",
  "resourceIds": ["actual authorized resource IDs"],
  "grantedTo": "observed runtime identity",
  "verifiedAt": "ISO-8601 timestamp",
  "product": "workers|d1|r2|dns|access|...",
  "docsUrls": ["https://developers.cloudflare.com/..."],
  "apiMethods": ["GET ..."],
  "requiredInputs": [],
  "risk": "read|write|destructive|security|billing",
  "preflight": ["check live authorization", "validate target and input"],
  "safeTest": "read-only or isolated synthetic fixture",
  "receipt": "request ID, resource, status, readback",
  "approvalGate": "owner/reviewer/none under standing policy",
  "status": "unverified|documented|tested|blocked"
}
```

No invented permissions or IDs. Keep token values, JWTs, secrets, cookies and user data out of this catalog. A scope grants *possible access*, not blanket permission to change a resource.

## Bubbles training sequence

1. **Discover** the effective permission inventory from the *actual connected runtime identity* using an authorized read-only operation. Record names, IDs, resource scopes and verification time; never read token values. If the API does not expose effective scopes, mark unverified and require a nonsecret policy export or an authorized administrator check.
2. **Classify** into product families: Workers/Pages, D1/KV/R2, Access/Zero Trust, DNS/routing, security, analytics, queues/workflows, AI, billing and account administration. Avoid treating 386 scopes as 386 separate capabilities.
3. **Retrieve docs** for each product/API operation. Record required parameters, permissions, example error states, idempotency and rollback. Distinguish what Bubbles can explain from what its connector can actually execute.
4. **Exercise safe read-only operations** with known owner resources. Capture actual request IDs/status/readbacks, not model-generated assertions.
5. **Stage writes** in isolated resources with preflight diff, explicit allowed target, tests, and safe rollback. Preserve existing production Workers, routes, D1, secrets, schedules, domain and bindings.
6. **Gate dangerous actions** (deletion, permission changes, DNS cutover, Access policy changes, billing, irreversible storage, production deploys) on independent review and any specific owner confirmation required by policy.
7. **Publish skill cards** to Brain only after tests and signed tool receipts: intent, docs, available tool, scope, required input, guardrails, dry-run, execution, verification, recovery.
8. **Continuously refresh** on API/schema changes and scope revocation. Invalidate stale authorization; do not reuse an expired five-day owner grant or substitute StarQuest wallet identity for Cloudflare sign-in.

## Initial skill matrix

| Product | Learn | First safe exercise | Production gate |
| --- | --- | --- | --- |
| Workers | inspect scripts, versions, routes, service bindings, deployments | read script metadata and deployed version | review full config + exact-head tests before deploy |
| D1 | list databases, inspect schema, prepared SQL | read-only bounded query | backup/validated migration/transaction and readback |
| R2 | bucket/object policies, access, metadata | list permitted bucket metadata | scoped object permissions and privacy checks |
| DNS | records, proxy status, zones | list zone records | diff, impact review, rollback |
| Access | apps, policies, JWT audience and identity | read app/policy metadata | independent security review; no lockout |
| Analytics | GraphQL groups, windows, freshness | bounded historical read | validate dates/counts before ledger write |
| Queues/Workflows | consumer routes, retries, idempotency | read configuration | prevent duplicate work and charges |
| Security | WAF, rate limits, bot and API Shield | read ruleset | independent review before traffic-impacting change |

## Engineering acceptance

- Inventory total, identity and scopes are **observed**, not owner-reported alone.
- Every indexed permission has documentation provenance and risk classification.
- At least one actual authorized read-only call per enabled product family produces a receipt.
- A signed Brain task can select the right tool, reject an out-of-scope request, and return a real tool result.
- No production mutation or new secrets are required for documentation ingestion.
- The training catalog is *not* proof that Bubbles has learned or successfully used the permission. Runtime tool dispatch, permission enforcement, and actual acceptance must be tested separately.

Related: QuantaPhi #1145/#1192, Moltnook AGENTS.md, Bubbles signed assist/result contract. Preserve existing hourly Continuity Builder schedule and all APK/consent holds.
