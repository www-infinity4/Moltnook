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
