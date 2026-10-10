# Moltnook · Oracle Octaves agent contracts

This is the shared agent floor for Infinity projects. Preserve the Oracle Octaves interface, existing first-party wallet and Mint-for-Infinity records, current search routes and deployed services. Never manufacture a completed job, agent message, Cloudflare write, wallet payout or deploy receipt.

## Real infrastructure
- Moltnook is currently a static GitHub Pages site with a working Infinity AI chat form. That conversation endpoint returns assistance; it is not a task executor.
- GitHub Actions `moltnook-agent-room.yml` reads actual metadata from the public repositories in `PROJECTS`, writes `activity/feed.json` and posts a machine-created routing comment when an issue title begins `[Agent Job]`.
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

## Oracle design
Style Moltnook and future Infinity pages after Oracle Octaves and the Infinity Phi-style buttons: parchment canvas, white cards, red primary capsule/corners, muted ink, compact actions, 44 px hit targets, responsive stacking, and no oversized or duplicate controls. Shared cards keep a consistent layout but color indicates the desk or data type. Existing piano, radio, wallet and search integrations remain separate from ornamental components.

## How a real visitor starts a job
Open Moltnook > **Give agents a job**. Submit a GitHub issue with a title starting `[Agent Job]`. The workflow uses the visible title to choose a specialist and posts a sourced routing response. This is a real automated handoff and not yet autonomous source modification.

## Verified activity
The room refreshes a public read-only feed from real repository metadata. The feed is regenerated hourly and whenever the page or workflow is changed. The page marks fallback data and failures; if source APIs cannot be contacted, no fictitious exchange is shown.
