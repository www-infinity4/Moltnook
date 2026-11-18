# Bubbles approved source forks — existing owner GitHub credential

Canonical issue: https://github.com/www-infinity4/QuantaPhi/issues/1907
Related Android Security Lab PR: https://github.com/www-infinity4/Moltnook/pull/255

## Reuse the working fork path

Moltnook's original fork-language-upstreams.mjs used the existing GHP secret in GitHub Actions to fork astral-sh/uv and astral-sh/ruff. GitHub parent readback was verified on the 2026-10-19 main run (Moltnook PR #104). This update preserves forkLanguageUpstreams() and shares the same parent, owner-identity and idempotency checks with the new adapter. No additional owner token is requested.

## New allowlist

Only morluto/rea (MIT) is approved for the first new source fork. No Frida or other upstream is in the executable allowlist yet; no user-supplied arbitrary repository URL is accepted.

- Pull requests and pushes execute offline unit tests; they do not create forks.
- After independent review and merge, the workflow's owner-initiated workflow_dispatch may fork REA using existing GHP. The GitHub actor must be www-infinity4, and the credential must separately identify that account via GitHub API /user.
- Results are fork_verified, unconfirmed or blocked; the exact upstream parent is validated before reporting success. Never retry an ambiguous POST in the same run.
- A fork is not REA installation, Frida execution, APK inspection, Bubbles signed-runner authorization, or deployment. Keep all secrets and user-private data out of the fork artifacts.

## ChatGPT direct fork capability is still separate

The connected ChatGPT GitHub tool currently exposes repository and PR writes but not POST /repos/{owner}/{repo}/forks or workflow dispatch. This first stage adds an authorized owner-GitHub-Actions operation but does NOT claim that ChatGPT itself has received a direct fork tool.

Next: register fork_approved_source in the EXISTING signed Moltnook/Brain runner only after validating actual owner grant, lease, allowlist, scoped caller and real result. This should call the reviewed workflow or reuse the same trusted action, never give a public Bubbles user owner-fork rights.

## Recovered owner fork inventory and nonfork decisions

Already forked: www-infinity4/AI3 from microsoft/AI, www-infinity4/ai from vercel/ai, www-infinity4/claude-flow from corticalstack/claude-flow, www-infinity4/searxng from searxng/searxng, www-infinity4/uv and www-infinity4/ruff from Astral, and the user's three recent Obsidian forks.

Not automatically forked: frida/frida (release-binary repo; metadata NOASSERTION and security/host review pending), EmulatorJS/EmulatorJS (GPL-3.0, separate games acceptance); Chromium (the X post was about repository size, not an authorized runtime import). The @lumixsv Power Chain research-agent setup is an architectural reference, not a confirmed public source repo.

This keeps QuantaPhi #1907, #1912 and #1931 as authoritative dependencies rather than creating another Bubbles engine.
