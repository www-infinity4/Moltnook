# Bubbles deterministic program adapters — source stage

Canonical owner work: QuantaPhi issue #1907, Continuity Builder #1908, automation/search #1913. Reuse Moltnook signed repository engine, QuantaPhi WORK_DB Brain Clock lease/fence, owner bridge and BOT_WALLET. No second scheduler or new authorization service.

## Interface and exact execution boundaries

Import executeProgram(ticket, adapters) from job-programs.mjs. All 12 program names and the common job contract are versioned in job-programs.contract.json. Caller must authenticate signed owner grant and current lease ID/fence; independently checked verifyLease is mandatory. Never trust the ticket.authorized bit or a public browser session as proof. Each program returns status and a receipt, which must be durably persisted by the owner-scoped existing coordinator before being displayed as persisted.

| Executable program | Existing coordinator trigger | Evidence/output |
| --- | --- | --- |
| ingress_task_parceler | Signed owner intake | Validates up to 16 approved atomic jobs and enqueues through approved adapter |
| stateless_branch_executor | Verified writer claim | Delegates a single isolated job branch to signed runner and verifies commit/test receipt |
| deadlock_queue_sweeper | Existing BrainClock DO alarm / blocked signal | Bounded retry of idempotent jobs only, never permission/review bypass |
| telemetry_quant_harvester | Consented source event | Pinned source hash and unverified staged Quant |
| schema_wallet_binder | Validated staging ingress | Hash, deduplicate, owner partition without guessing wallet or paying |
| state_continuity_compiler | Existing session close / batch event | Versioned context proposal; no trusted instruction overwrite |
| spec_to_ticket_compiler | Approved feature directive | DAG order, cycle rejection and manifest digest |
| deterministic_code_writer | Signed Green assignment | Scoped PR staging through runner, not a merge |
| dynamic_card_synthesizer | Approved data/view schema | Escaped, accessible source-linked HTML component; live binding is separate |
| sandbox_gate_enforcer | PR webhook under existing auth | Unit/security/syntax test receipt only; no independent approval or merge |
| immutable_ip_notary | Verified merge/asset event | Signed hash and audit append; not legal IP ownership |
| compute_settlement_router | Signed billed event | Independently verified WORK_CREDIT metering via existing wallet, not cash minting |

## Staged release and Cloudflare wiring

The additive job-programs-schema.sql is optional evidence-only D1 schema to be migration-reviewed for the existing authorized WORK_DB. Do not recreate work_tickets, change the existing Durable Object migration or write monetary balances here.

Cloudflare cron is minute resolution; the 15-second sweep should use the existing BrainClock Durable Object alarm and bounded scheduling, not a new cron service. Wire the module in the existing signed authenticated BrainClock/runner only after independent security review. Production bindings, secrets and wallet services are unchanged by this source PR.

Run Node 22: node --check agents/repository-engine/job-programs.mjs and node --test agents/repository-engine/job-programs.test.mjs. Require exact-head GitHub checks and independent security review before guarded expected-head merge. Source merge, Cloudflare deployment, verified signed runner execution and Android acceptance require separate receipts.

These handlers are executable with actual signed adapters; this source stage alone does NOT create 12 active Cloudflare workers, claim worker spawning, create live Quick Cards or establish production deployment.
