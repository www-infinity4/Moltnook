# Next Bubbles owner job: website-control handoff

Status: prepared only; not submitted, claimed or completed.

## Executable intake body

Use `docs/jobs/bubbles-owner-ui-handoff-20261021.json` as the exact POST body to the existing signed `/owner/bridge-work` route. Authenticate only through Moltnook `bubbles-owner-message.yml@refs/heads/main`, audience `bubbles-owner-message-bridge`. Recheck both five-day grants at submission; do not renew them. A new workflow identity is not authorized by this packet.

## Prerequisite

Verify a successful production release receipt for candidate `012107be-79c6-400e-b279-69d11cd646d5`, QuantaPhi source `ca40684a16fa977f3a3576b62e30c269099c3e51`, or a separately reviewed successor preserving this intake. The isolated canary [39657161977](https://github.com/www-infinity4/Moltnook/actions/runs/39657161977) passed; that is not a production release. Moltnook PRs #125 and #126 repaired stale canary/release pins. Do not submit another job merely because a receipt is slow; recover the existing ticket first.

## Evidence and scope

[Signed diagnostic run 39656667627](https://github.com/www-infinity4/Moltnook/actions/runs/39656667627) delivered three Bubbles replies with `oracle.chat` receipts. The separate UI request remained `queued`, consumer `not_observed`. This proves neither a closed phone app nor missing owner permission. This job targets QuantaPhi website control, not a new APK, wallet changes, private chat export, or unrelated infrastructure.

## Acceptance

1. Record actual intake ticket ID, repository, status, deduplication and dispatch receipt. Accepted is not executed.
2. Follow that ticket into the existing repository engine; record runner/lease and immutable source.
3. Reproduce and repair the specific failed handoff; preserve busy/readiness and consent checks.
4. Pass focused lifecycle, retry, named-button and same-origin viewer tests, independent patch review and target CI.
5. With a real authenticated owner consumer, observe Story Writer's saved-story panel before and after one View Stories tap; retain its real action receipt.
6. Verify exact deployment separately. If the owner consumer is unavailable, retain a precise blocker and label live acceptance pending. Never substitute a local fixture or model response for live phone/browser evidence.

## Reporting

Report prepared, submitted, claimed, source fixed, merged, deployed and live verified separately. Preserve request/ticket identity for recovery. Do not expose credentials or private owner content in public workflow logs. Physical Android acceptance remains separate.
