# Bubbles & Brain — owner engineering execution contract

Canonical owner recovery: https://github.com/www-infinity4/QuantaPhi/issues/1192
Bubble Bits: https://github.com/www-infinity4/QuantaPhi/issues/1296

## Separation of concerns

- **Bubbles** owns the single chat and voice experience, card interactions, user criteria, readable progress, and links to actual receipts. It never receives a GitHub token, commits code, changes wallet balances or declares deployment based on model text.
- **Brain** owns owner authentication, durable work tickets, leases, model/tool routing, source reads, GitHub credentials, state transitions, validation, tests, reviews, PRs and per-step results. Every work request has one immutable correlation ID, owner partition, repository scope and event log.
- **Executor** is the existing signed Moltnook GitHub Actions runner, not the public Moltnook chat form. The existing QuantaPhi Brain Clock controls admissions and job lease selection; owner authorizations and expiry remain authoritative.
- **Adapters** provide only capabilities actually connected and verified: GitHub repository, source tests, Cloudflare/Workers/D1, browser, search, media, and deployment. A model selecting a tool does not grant that capability.

## A true Work session

1. Receive one owner-authenticated request and its explicit success criteria in Bubbles, preserving the original conversation/thread ID.
2. Retrieve the authorized owner context first. Context controls the proposed task shape; it never grants permissions or transfers access between users.
3. Resolve the correct repository and existing issue, check active lease and source SHA, claim one durable task with a fence and expiration. If not claimed, return the exact typed reason; no fabricated activity.
4. Inspect current source and select a narrow execution adapter; keep independent research and plan evidence. Retry transient reads but never blindly replay a write.
5. Apply source edits to an isolated branch. The current engine uses one atomic local Git commit and pushes a task branch. For an API-only multi-file adapter use blobs → tree → commit → compare-and-swap ref with force disabled; do not substitute several unrelated Contents API PUTs.
6. Run focused tests and full repository-specific acceptance; record exact test output and commit SHA. Pink and GPT Purple review do not substitute for test results.
7. Open a reviewable PR, verify its latest head, GitHub mergeability, required checks, protected branch rules, and independently recorded authorization before a merge. The PR can remain open for review when any gate is unverified.
8. Independently verify the deployed source or live browser only after merge and release. Distinguish source_tested, committed_unverified, merged_verified, deployed_verified and complete.
9. Persist append-only state transitions and results under owner/session/ticket IDs so closing Bubbles or running out of a model session does not erase the job. Resuming requires re-authentication and an actual server-side status read; never assume continuing execution.

## Event and status contract

Each event carries schemaVersion, eventId, owner-bound session, ticketId, jobId, revision, phase, status, timestamp and evidence references. The server deduplicates eventId and enforces monotonic revision/valid status transitions. The browser receives only sanitized summaries and approved receipt URLs, never secrets or raw personal context.

Phases: context → resolve → claim → inspect → plan → edit → test → review → commit → PR → CI → merge → release → live_check. Failures carry a typed reason, next possible action and source receipt. Accepted/queued, tool_started and code_written are never completed/deployed.

Bubble Bits: a distinct, criteria-specific skill-like observed iteration per verified tool step. Its visible row can appear when started and change to verified only on a receipt. The frontend observation counter is not a spendable credit; any settlement requires a separate authenticated, transactional, idempotent D1 ledger. Gits (contribution rewards per eligible reviewed added line) require a different anti-abuse accounting contract and are not automatically minted by a GitHub commit.

## GitHub API guarantees

- All GitHub credentials are server-side. The currently deployed engine uses the existing Moltnook Actions GHP secret and OIDC identity for Brain calls; transitioning to a least-privilege GitHub App is a separate migration with verified installation and webhook setup.
- Pin a fresh branch SHA and require non-force, compare-and-swap updates. Do not infer the remote SHA from a local cache; repository metadata caching is not branch state caching.
- Use conditional ETag GET for stable metadata; never cache mutable refs, PR mergeability or check results in the new client.
- Honor Retry-After and x-ratelimit-reset. If GitHub returns 429 without timing headers, defer at least 60 seconds rather than hammering the API. Backoff reads only, never replay an uncertain POST, PATCH, PUT or DELETE without a fresh, authoritative read.
- Sequence mutating requests within the job queue and honor GitHub secondary limits. A lost write response is an unknown outcome, not a failed write that may safely be retried.
- GitHub webhooks (push, pull_request, check_run, issue_comment) should be received on an authenticated Worker, with signature validation, delivery-ID deduplication and an allowlisted repository/installation. Then update the durable event store and notify Bubbles over an owner-authenticated stream. Keep bounded polling as the reconnection/fallback path; a webhook alone is not an execution grant.

## Acceptance and rollout

The first real proof is an owner job that generates a verifiable source diff, passes tests and independent review, opens a PR and returns the matching receipt to the same Bubbles conversation. Then verify deployment separately. Test lease races, owner/session switches, replays, API 429/503, stale heads, conflicts and missing provider credentials. Preserve the existing Android APK security hold, wallet isolation, signed owner grants and branch rules.

**Current scope of this branch:** replace the repository runner's naive GitHub API helper with an isolated request client and regression tests; wire it into both relevant CI workflows. This does not activate new D1 databases, webhooks, generic website deploys, new GitHub tokens, phone control or full agent-equivalent tool access. Those remain explicit follow-up tasks requiring their own acceptance receipts.

GitHub API guidance: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api and https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api.
