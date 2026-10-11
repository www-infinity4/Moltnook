# Branch-only browser repair dispatcher

The browser observer records failures in `repository-receipts/public-live-browser.json`. Merged PR #23 translates these failures into deduplicated `[Agent Job]` issues in `www-infinity4/Oracle-Octaves`. The separate dispatcher reads public issues as untrusted data, validates the receipt and immutable source commit, then (only when explicitly enabled) creates a **draft** pull request in `www-infinity4/QuantaPhi`.

## Authorization

GitHub OIDC identifies a workflow to a configured trusted service; it **does not** itself allow pushing GitHub branches. This workflow instead calls `actions/create-github-app-token@v2` with an installation limited to repository `QuantaPhi`, `contents:write`, and `pull-requests:write`. It requests no `workflows`, `issues`, administration, secrets, actions, deployments, or wallet permission. The default `GITHUB_TOKEN` has only `contents:read`; checkout never persists credentials.

Provision repository secrets `REPAIR_BOT_APP_ID` and `REPAIR_BOT_APP_PRIVATE_KEY` for a GitHub App installed on QuantaPhi. The App's allowed repositories and permission set must be independently reviewed. Set the repository Actions variable `REPAIR_DISPATCH_ENABLED=true` **only after validating the mock failure and reviewing the App installation**. Without both the enable flag and secrets the workflow does not create PRs. `workflow_dispatch` with the default `apply=false` runs only dry-run checks; applying requires both `apply=true` and the enable flag. No bearer token is printed or stored in artifacts.

## Current bounded repair scope

The first active repair type is `QuantaPhi/index.html #shoplcShirtButton` with the independently pinned desired URL `https://quantaphi.org/shoplc/`. The dispatcher refuses an issue unless it carries the prior browser run URL, a unique selector source lookup, immutable repository commit SHA, the expected canonical href, and a nonmatching observed href. It re-fetches the pinned `main` SHA, parses the uniquely matching static anchor, and checks the actual source href equals the observed one. If source is already correct, the failure must be investigated as runtime/cache/routing rather than blindly editing code. A stale SHA, ambiguous anchor, missing receipt, mismatched source, unsupported repository, or missing credential blocks a repair.

A successful repair writes only a new `repair/browser-...` branch and opens a **draft PR**. No automated merge, direct main commit, deployment, database change, wallet update, arbitrary issue-supplied shell command, or regex rewriting of unrelated files is allowed. Independent review, tests, and fresh live browser observation are still needed to finish the ticket. GitHub branch protection should prohibit direct bot pushes to `main` in addition to these software restrictions.

The dispatcher is scheduled for minutes 13 and 43 each hour once enabled. It processes at most one eligible repair per run, deduplicating existing PR branches. For fixture-based testing run `node --test scripts/repair-draft-dispatch.test.mjs`; the tests simulate an incorrect ShopLC href through draft PR creation without real credentials, repository writes, or failing production pages.

## Limits

This is a separate, limited bridge to draft-PR generation, not a general autonomous refactoring engine. Non-ShopLC tickets remain queued for agent review until purpose-built, verified repair adapters are added. If the source was already correct, live browser evidence alone does not authorize a code patch. No production dispatch is claimed until an actual App-scoped run emits a draft PR receipt.
