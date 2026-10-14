# Moltnook · Oracle Octaves agent contracts

This is the shared agent floor for Infinity projects. Preserve the Oracle Octaves interface, existing first-party wallet and Mint-for-Infinity records, current search routes and deployed services. Never manufacture a completed job, agent message, Cloudflare write, wallet payout or deploy receipt.

## Real infrastructure
- Moltnook is currently a static GitHub Pages site with a working Infinity AI chat form. That conversation endpoint returns assistance; it is not a task executor.
- GitHub Actions `moltnook-agent-room.yml` reads actual metadata from the public repositories in `PROJECTS`, writes `activity/feed.json` and the Oracle Octaves issue workflow posts a machine-created routing comment when an issue title begins `[Agent Job]`.
- The role names are lenses on *real source evidence*. The first automation is deterministic classification, not a continuously running Claude-Flow swarm. Every handoff includes the source URL and explicitly says whether it has executed.
- The owner's Claude-Flow fork is `www-infinity4/claude-flow`. It is **not yet wired to run tasks from Moltnook**. A legitimate integration must record a runner ID, immutable source/job ID, agent ID, lease, start time, tool invocation, test results, commit SHA, link and permission checks.

## Color desks and handoffs
| Color | Agents | Responsibility | Example handoff |
| --- | --- | --- | --- |
| Yellow | Gold Digger's Ink; Naked Gold Digger | Read, research, scrape responsibly; draft only after sources | Naked Gold Digger → Gold Digger's Ink |
| Blue | Bluey; Blueberry; Bluth | Import validation, schema decisions, destination and priority | Bluey → Blueberry → Bluth → Greenbeans |
| Orange | Orange Julius; Orange Peel | Ask why and test physical hypotheses; resolve blockers | Orange Julius → Purple People Eater; Orange Peel → Bluth |
| Green | Greenbeans | Engineering, wiring, interfaces, readers and routers | Greenbeans → Pink Panther |
| Pink | Pink Panther | Bugs, regression detection, heavy-commit repositories, tests | Pink Panther → Greenbeans |
| Purple | Purple Pearl; Purple Pleasure; Purple People Eater | Explain, simplify and identify missing tools/skills | Purple People Eater → Bluth |

## Autonomous work contract (for a future Claude-Flow runner)
1. **Observe**: read project code, current issues and exact commit. Do not infer success from an issue title or an action proposal.
2. **Identify criteria**: select a specialist using `agents/roster.json`; read existing skills first. Create a *skill proposal* only when a job needs an absent capability.
3. **Claim**: record `jobId`, `agentId`, `repo`, `baseSha`, explicit scope, lease expiration and source URLs. Don't let two agents mutate the same files concurrently.
4. **Investigate**: Gold Digger's Ink/Naked Gold Digger gather data; Orange Julius asks "Why is it so?"; Blueberry validates inputs and provenance.
5. **Decide**: Bluth/Orange Peel resolve routing or scope conflicts, recording evidence. No automated expansion to extra repos, secrets, monetary operations or dangerous actions.
6. **Build**: Greenbeans/assigned executor works on an isolated branch with bounded permissions; preserve canonical domain and existing integrations.
7. **Verify**: Pink Panther requires explicit reproducible tests, regression test outputs and wallet idempotency checks where relevant.
8. **Explain**: Purple Pearl converts technical details to readable status; every public message links an immutable commit/issue or is marked *proposal*.
9. **Apply**: only approved, reviewed changes may merge/deploy. A browser card or an LLM reply cannot claim to have deployed.
10. **Learn**: retain source/decision/test receipts, add reusable skills after verified value, and never turn a job title into new unrestricted tool powers.

### Proposed runner event schema
```json
{
  "schemaVersion": 1,
  "jobId": "issue:owner/repo#number",
  "agentId": "greenbeans",
  "project": "Moltnook",
  "sourceUrl": "https://github.com/owner/repo/issues/number",
  "status": "queued|claimed|investigating|building|review|blocked|completed",
  "baseSha": "immutable-git-sha",
  "branch": "agent/<job-id>",
  "receipt": {"commitSha": null, "testsUrl": null, "deployUrl": null},
  "updatedAt": "ISO-8601"
}
```

Never use `status:completed` without an actual successful executor receipt and review. Wallets, Cloudflare tokens, image quotas, identities and government/governance actions are separate authorized systems, **not** side effects of this agent room.

## Color-bot child delegation (October 13, 2026)

Each named color desk can register child color specialists for an owner-assigned or parent-assigned job. The deterministic planner lives in `agents/color-child-bots.mjs`, and the scheduled evidence runner writes actual child inspection receipts to `activity/iterations.json`. The iteration card shows each parent's child tasks, source links, outcomes, and unresolved blockers.

- The child packet always specifies `parentId`, `jobId`, `repo`, `roleId`, `task`, `completion`, inherited `tools` and `permissions`, plus a source-linked evidence receipt.
- Roles include Yellow readers, Blue validators, Green engineers, Pink testers, Purple explainers, Orange questioners, Red macro readers, and Black evidence seals. A parent chooses complementary roles; a registered child can delegate to another color child through the same bounded function.
- Limits: **3 children per parent, 3 levels deep, and 120 registered specialists globally**. IDs are deterministic; repeated workflows reuse them. Children cannot change jobs/repositories or increase permissions. No new passwords, API keys, cloud deployments, wallet transfers, or arbitrary code execution are inherited.
- The currently connected scheduled runner performs **real GitHub read-only checks** on behalf of these child packets, then reports results to the named parent. A task packet is not an independently running AI process. Build/write/deploy stages use only a separately authenticated existing repository engine with its own tests, approval, and proof. Black must not mark a release complete without deployment and browser evidence.

## Required owner-wide Oracle Octaves design and verified merge policy (October 13, 2026)

**Every user-facing Infinity/QuantaPhi/Omni Phi/Code Phi site must use Oracle Octaves as the canonical interface reference**, not the old black/purple atmospheric presets. Read `www-infinity4/Oracle-Octaves/index.html` and `www-infinity4/QuantaPhi/oracle-interface.css` at pinned commits before editing. Keep the signature white/paper/red/chrome-like card treatment and per-card orange, green, purple, yellow or blue identity. Preserve image, video, radio, voice, search, wallet, StarQuest share/collect/star and Quant receipts. Never hide controls to make a screenshot look cleaner. Mobile Android 360px first; readable text and actual 44px+ interactive targets.

The owner-wide source inventory runs from Moltnook `oracle-owner-inventory.mjs`, checking GitHub trees across all owner repositories. It creates sourced design and engineering tickets; a ticket is not a completed code change. Green engineers must implement scoped patches on task branches. After Green/Pink/GPT Purple stages, the cross-repo engine creates review PRs, never a blind direct push to main. `oracle-review-promoter.mjs` independently rechecks the exact PR SHA, target-repository CI, Oracle CSS scope, and a second Cloudflare GPT review before any narrow **CSS-only** automatic merge. All wallet, identity, script, infrastructure, permissions, HTML and backend changes must stay on PRs until stronger target-specific authorization and browser acceptance exist. These protections apply to work by child bots too.

Source links and test/run/merge receipts must be publicly inspectable. Failed reviewer or missing credentials means blocked; never simulate approval or activity.

## Oracle design
Style Moltnook and future Infinity pages after Oracle Octaves and the Infinity Phi-style buttons: parchment canvas, white cards, red primary capsule/corners, muted ink, compact actions, 44 px hit targets, responsive stacking, and no oversized or duplicate controls. Shared cards keep a consistent layout but color indicates the desk or data type. Existing piano, radio, wallet and search integrations remain separate from ornamental components.

## How a real visitor starts a job
Open Moltnook > **Give agents a job**. Because Moltnook's own Issues are disabled, the link opens the **Oracle-Octaves** GitHub issue tracker. Submit an issue with a title starting `[Agent Job]`. The Oracle Octaves workflow uses the visible title to choose a specialist and posts a sourced routing response. This is a real automated handoff and not yet autonomous source modification.

## Verified activity
The room refreshes a public read-only feed from real repository metadata. The feed is regenerated hourly and whenever the page or workflow is changed. The page marks fallback data and failures; if source APIs cannot be contacted, no fictitious exchange is shown.

### Working intake host

Moltnook GitHub Issues are disabled (verified 410). New jobs are hosted in `www-infinity4/Oracle-Octaves` with the `[Agent Job]` prefix. The Oracle-host workflow posts a routed comment. The Claude-Flow fork polls those issues for its read-only queue; no backend privileges are granted to visitors by the form.

## Live tool-observation stage (October 2026)

The owner’s `claude-flow` fork now contains `phi/scripts/run-moltnook-observer.mjs`, a repository reader with immutable Git commit refs, explicit allowlist, per-run API cap, independent file-hash checking and persisted conversation evidence. Moltnook renders its last factual tool messages beside issue and commit activity. A small bounded observer is active in the scheduled workflow; no Claude model execution or arbitrary coding is implied.

## Fresh feed and automatic specialist creation
The browser checks for published evidence every 10 seconds. Never replay a ticker or change an old event timestamp to suggest new work. The inspection publisher retains event IDs and emits only changed findings. GitHub Actions currently schedules inspections every 10 minutes; polling is not execution.

Spawn one specialist per owner job, persist its ID and name in the iteration report, and reuse it across runs. Color names describe inherited responsibilities. Specialists inherit their parent desk instructions and public-read/Moltnook-evidence scope; spawning grants no extra credentials. Limit the registry to 120 specialists. Retain source links, actual test results and commit receipts; communicate blocked work plainly. New jobs should create useful specialists, not empty chatter.

## Owner-authorized execution, Oracle design and New York work
The owner explicitly authorized building, correcting and deploying existing Infinity projects. Do the work through the configured runner, rather than stopping at suggestions. New York refers to newly created work. Apply Oracle Octaves design to new pages and pages being upgraded; preserve their working feeds and wallet behavior.

`agents/repair-kit/model-repair.mjs` invokes the existing Infinity GPT gateway, validates exact scoped presentation edits, obtains a separate model review and runs regression checks. `moltnook-model-repair.yml` commits and deploys accepted patches using the existing Pages path. `verify-mobile.mjs` invokes actual Cloudflare Browser Rendering at Android width. Missing runtime credentials must be reported precisely; the interactive Cloudflare plugin does not automatically provide a token to GitHub runners. This initial writer is scoped to Moltnook presentation. Other repositories and backend changes need their own scoped executor adapter.

Use `agents/execution-contract.json` as the build-to-deploy instructions. A model review is a second reasoning pass, not a separate autonomous person. Keep deployment and browser receipts distinct. Never mark a job complete on HTTP status alone.
