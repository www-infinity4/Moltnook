# Moltnook repository engine

Yellow reads the owner request and repository instructions. Blue refines dependency handoffs. Green proposes exact source edits. Pink independently reviews them. Actual repository checks run. GPT Purple approves, rejects or blocks using their outputs. The authenticated runtime commits only the reviewed source.

## Runtime access

The scheduled GitHub workflow is the bot's executor. Role names and prompts do not grant credentials. All stages use that executor's repository tools; models never receive the credential.

The current workflow expects the Moltnook Actions secret **GHP** as REPOSITORY_WRITE_TOKEN. Configure it at https://github.com/www-infinity4/Moltnook/settings/secrets/actions . A fine-grained credential must use resource owner www-infinity4, All repositories, Contents read/write and Metadata read. The runtime inventories actual visibility and reported push permission, then verifies each target. Repository rules and archived repositories can still block writes.

For permanent operation, a dedicated GitHub App installed on all owner repositories with short-lived installation tokens is preferable. This workflow currently uses GHP; the interactive ChatGPT GitHub installation does not automatically authenticate this unattended executor. A repository-local GITHUB_TOKEN cannot access all owner repositories. Do not put a token in source, logs or chat.

## What is implemented

- Owner-wide job routing and serialized repository leases.
- Pinned source inspection, refined plan, exact patch, independent review and GPT Purple arbitration.
- JavaScript/Python/HTML parsing and existing npm test/build commands.
- Source commits with verification receipts, immutable source previews and exact blockers.

## Clone → Python toolbox → GPT-reviewed pull request (staged build)

The cross-repository engine already clones each owner repository into a temporary workspace and runs Yellow/Blue/Green/Pink/GPT Purple stages. This update makes **all bot-generated changes go onto `robot/<job>/<run>` branches and into reviewable pull requests**, even where `main` is unprotected. A successful source test is not live deployment evidence. No automated default-branch merges are enabled by this change.

- Every selected job pins its source SHA, reads owner instructions, generates a bounded patch, independently reviews it, and executes repository checks before GitHub creates a staging PR. The code cannot try `git push HEAD:main`.
- `code-phi-python-toolbox.yml` is a separate **credential-free**, on-demand GitHub Actions clone runner for a specified owner repository and exact commit SHA. It provides Python 3.12, `venv`, standard-library checks, unittest discovery, and optional **SHA-256 pinned binary wheel** packages from `requirements-toolbox.lock`. It retains receipt artifacts. It does not accept arbitrary shell commands or unpinned `pip install`; Android/Termux is not executing the tests.
- `robot-branch-review-checks.yml` runs source-stage regression tests on Moltnook PRs without giving the PR code the write credential. Other repositories still require their own target checks.
- `robot-brain-auto-tickets.yml` inspects recent `activity/iterations.json` receipts every 15 minutes, raises at most two deduplicated **[Agent Job]** GitHub issues per run in the issues-enabled Oracle-Octaves tracker for observed missing files or failed CI, and attaches source evidence. Its ticket routing is real, but this alone does not enqueue a live repair lease into the separate Brain Clock executor.
- To audit a job, check the originating GitHub Actions artifact, task branch diff, PR, target CI, reviewer result, and only then production acceptance evidence. The browser polls every 10 seconds; polling does not imply an actual repository edit every 10 seconds.

**Activation boundaries:** after the PR merges, the Python toolbox can be dispatched with a pinned commit. The ticket sweep needs the preexisting `GHP` writer credential to create Oracle-Octaves issues; without it the workflow fails and records a blocker. Cloning owner repositories is distinct from forking them in GitHub: this implementation uses isolated local clones and task branches, not new fork repositories. Automated promotion to `main` remains disabled until independently verifiable, target-specific CI and reviewer gates exist.

## Scheduled review and owner-wide design inventory

`oracle-reviewed-pr-promotion.yml` is an independent 15-minute reviewer. For **new** `Robot review:` PRs it verifies a pinned exact head SHA, same owner repository, target GitHub Actions checks, GitHub mergeability, CSS-only non-sensitive diff, and a second Cloudflare Workers AI `gpt-oss-120b` code review. The model posts a traceable PR review comment. Only approvals with current passing checks can be squash-merged into main. GitHub branch rules remain authoritative; a missing model token, absent CI, failed checks or review rejection blocks promotion. The model review runs as an explicit billed Workers AI inference, not this ChatGPT session.

`oracle-all-repo-inventory.yml` runs daily and on demand. It paginates accessible owner repositories, checks real UI/CSS/test/CI files and creates at most five nonduplicate `[Agent Job]` Oracle-Octaves issues per cycle, with pinned source evidence and exact Oracle design requirements. It does **not** itself deploy altered source or create Brain Clock leases. Existing authenticated readers and writers must adopt each ticket through a supported owner job path.

The design reference is `www-infinity4/Oracle-Octaves/index.html` and `www-infinity4/QuantaPhi/oracle-interface.css`; white daylight cards, paper #f7f4f0, ink #312722, red #b83b32 actions, 18px corners and accessible Android controls. Retain each card's original hue and all working features. The first automatic merge policy intentionally only covers small CSS/SCSS changes. Broader automated UI deployment requires controlled preview/build/runtime adapters per repository.

## Remaining adapters

The generic engine does not yet deploy every repository or implement canary/rollback across providers. Unknown languages, package managers, missing acceptance commands and framework page rendering require project adapters. Secrets and execution permissions are excluded from generated source patches. Committed source remains **committed_unverified** until live acceptance is proven. Source previews disconnect services and cannot prove database, wallet or production behavior. GPT Purple currently uses Workers AI's gpt-oss-120b model; it is a separate review stage, not this ChatGPT session.

## Evidence

The Robot Brain exposes current engine credential status, commit/diff/run links and paired screenshots. Workflow artifacts contain actual tests, plan, reviews and blockers. Missing credentials produce a blocked receipt instead of a success claim.

## Published engineering patterns

Google describes reproducible automated build/test/release workflows, change reports, canaries and rollback; engineers define the release rules. eBay describes reusable orchestrators with persisted task context and pluggable tasks, and Failbot correlates end-to-end failures with logs, screenshots and deployments. These patterns inform this engine; it does not reproduce their private internal systems.

Sources:
- https://sre.google/sre-book/release-engineering/
- https://sre.google/workbook/canarying-releases/
- https://innovation.ebayinc.com/stories/ebays-common-automation-solution-for-platform-evolution/
- https://innovation.ebayinc.com/stories/failbot/
- https://docs.github.com/en/actions/concepts/security/github_token
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
