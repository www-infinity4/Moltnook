# QuantaPhi / Create Phi: bot iteration evidence stream (staged adapter)

**Status: source-only adapter. Not deployed, not attached to live bots, not a wallet mint.**

This branch extends the existing `robot/bounded-context-hash-review-20261013`
source-window work without overwriting the concurrently updated `main`
or child-color-bot jobs. See `AGENTS.md`,
`agents/repository-engine/context-windows.mjs`, and
`agents/repository-engine/runner.mjs`.

## What it does

1. The existing authenticated bot inspects pinned Git source with
   `sourceWindows(...)`. `bot-adapter.mjs` creates a deterministic,
   at-most-15-line **hash-and-line-range** event for each real assessment.
2. `submitInspectionEvents` can call a dedicated Worker `POST /v1/iterations`,
   using a server-side token. The Worker validates source owner, hashes, stage,
   workload weight, agent and run IDs, payload size and request rate.
3. Cloudflare **Queues**, not Vectorize, is the message broker. The Worker sends
   only immutable metadata into a durable queue. HTTP 202 means *queued*,
   **not yet written**.
4. The queue consumer batches at most 25 statements per D1 call and records
   each unique transition in `token_state_transitions`. It acknowledges only
   successful inserts or IDs verified already present in D1. Errors retry and
   ultimately route to the configured dead-letter queue.
5. The authenticated `GET /v1/report?repo=www-infinity4/Moltnook` returns
   the last 24 hours' **actual D1** inspection totals and 10 newest activities.
   `GET /v1/resume?repo=...&quant=...` retrieves the latest state, pinned
   source SHA and line range for the next authorized agent.

All user-facing state must label `queued`, `persisted`, `blocked`, or
`unavailable` truthfully. Neither a browser refresh nor source ingestion
automatically creates a new Infinity token or a payable job receipt.

## Install boundaries

**No infrastructure has been created by this PR.** The deploy operator must
create a separate Cloudflare D1 database and Queues primary/DLQ pair; apply
`schema.sql` with D1 migrations; copy `wrangler.example.toml` to the
actual project manifest, supply the real D1 UUID, an unused integer namespace,
and a 32+ character `BOT_INGEST_TOKEN` via encrypted Cloudflare secret.
Do **not** paste tokens into code, GitHub issue text, mobile HTML or chat.

The existing `runner.mjs` now invokes the adapter **only when both**
`BOT_TRANSITIONS_URL` and `BOT_INGEST_TOKEN` are configured server-side.
Absent bindings are reported as `not_configured`; failed enqueue is reported
as `enqueue_failed`. Neither status claims D1 persistence or wallet payouts.
Enable the bindings only after D1, Queue, DLQ, migration, CI and staging
readback are independently verified.
Do not create a fake Cloudflare adapter or use a guessed domain/secret.
Its public API is:

```js
import {inspectionEvents,submitInspectionEvents} from './transition-stream/bot-adapter.mjs';
const {events} = inspectionEvents({
  original: {'src/card.js': pinnedFileText}, task: 'inspect layout',
  repository: 'www-infinity4/QuantaPhi', commitSha: pinnedCommitSha,
  jobId: job.id, quantId: job.quantId, agentId: 'pink-panther'
});
// Requires a *server-side* configured endpoint and secret:
const receipt = await submitInspectionEvents(events, {
  url: process.env.BOT_TRANSITIONS_URL,
  bearerToken: process.env.BOT_INGEST_TOKEN
});
// receipt.persisted === false until the actual D1 readback.
```

### Safe capacity and correctness

- Queue consumer batches are capped at **100 messages** by Cloudflare.
  The provided config uses 25, `max_concurrency = 4`. D1 batches run
  sequentially, not 500 SQL statements concurrently.
- `INGEST_RATE_LIMITER` provides a local/approximate burst limit,
  **not exact quota accounting**. The D1 indexed per-repo/hour insert guard
  enforces a hard cap of no more than 20,000 accepted transitions/hour/repo.
  Capped new events retry, then land in DLQ, rather than pretending they are
  completed or successful.
- Event ID is a SHA-256 of job/iteration/commit/file/snippet-hash/stage,
  so queue redelivery is safe and duplicate DB inserts are ignored. Separate
  lifecycle changes are separate events. Consumers do not assume queue order.
- Raw source windows and snippets are not stored; Git SHA + full-file SHA-256,
  snippet SHA-256 and line ranges allow authorized agents to recover evidence
  while avoiding leaked code/secrets in telemetry. Access to repository is
  separately authorized and source must be revalidated on read.
- `system_credit_value = 1` for a distinct inspection is **workload
  valuation**, not **StarCoins, Quant, Music Quant or Infinity balance**.
  Money/asset issuance requires the existing wallet's authenticated,
  idempotent settlement and durable readback. In particular, never bypass
  `invalid_quant_mint_credit` D1 ledger constraints by inventing credits.
- No model calls are triggered from the stream, so it cannot spin up an
  unbounded GPT loop. A separate LLM executor needs its own budget,
  authorization, retry cap, leases and immutable receipts.
- Queue messages eventually expire according to Cloudflare retention.
  Investigate DLQ backlog, failed insert retries, D1 capacity, and costs.
  This architecture does **not** guarantee millions of events per second.

### Verify the staged code

```sh
node --check agents/repository-engine/transition-stream/worker.mjs
node --check agents/repository-engine/transition-stream/bot-adapter.mjs
node --test agents/repository-engine/transition-stream/*.test.mjs
```

After deploying with real bindings, POST an authorized synthetic *non-wallet*
scan and verify GET `/v1/resume` finds its exact transition ID, SHA and
metadata in D1. Verify retries by temporarily failing D1 in a test environment.
Do not mark production ready without independent Cloudflare deployment and
live readback evidence.

Official references: Cloudflare Queues limits, batching/retries, D1 batch,
D1 platform limits and Workers rate-limiting bindings.
