# Bubbles Android Security Lab — safe source-only stage

Source references:
- Owner request: https://x.com/ArchiveExplorer/status/2122089818033393952
- Independent evidence-board idea: https://x.com/Klonzu/status/2122063487027249182
- Official REA: https://github.com/morluto/rea (pin/verify exact release and license)
- Official Frida Android guidance: https://frida.re/docs/android/
- Job continuity: https://github.com/www-infinity4/QuantaPhi/issues/1907

## Current scope
The adjacent `android-security-lab.mjs` supplies **pure input and evidence validation only**. It does not instrument apps, execute REA or Frida, launch emulators, authorize device access, create a Bubbles tool registration, render a live Quick Card, or prove an Android runtime. A syntactically valid proposal is not permission. Only the existing authenticated, signed, lease-bound executor can enforce owner/package/APK authorization, isolation, external effects and receipts.

First fixture must be an intentionally created test APK under owner control with synthetic data. Never start by sampling X, banking, messenger, browser or other third-party apps. Use test traffic metadata only, not message bodies, token values, passwords, locations, contact content, or secret plaintext. Rejected payload-bearing observations must not be logged into public CI artifacts.

## Implementation lane
1. Red/Blue discover the currently active signed runner, target repository SHA, verified REA/Frida releases and emulator prerequisites; document licensing, provenance and test fixture ownership.
2. Green adds a bounded authenticated adapter to the **existing** runner, never a second scheduler. Isolated disposable emulator, explicit fixture package/hash, restricted capabilities, no untrusted shell instructions, strict cleanup.
3. Pink writes a failing test before each behavior change and tests grant replay, package mismatches, expired leases, failure cleanup, sensitive-content refusal, reproducible synthetic fixture and redaction.
4. Evidence board shows only structured, anchored, bounded **unverified** observations until a separate trusted verifier checks source provenance, independent review and exact-head CI. Do not forward raw REA/Frida logs to the coordinating model.
5. Purple/Black compare source evidence and sign-off; unresolved mismatches remain visible; never claim merge/deployment/Android acceptance from counts in social posts.

## Stage signals
`source-policy-written` -> `focused-tests-passed` -> `reviewed` -> `signed-adapter-tested` -> `emulator-fixture-verified` -> `private-card-browser-verified` -> `deployed-and-accepted`.

Do not skip stages. Reports must provide actual SHA, workflow URLs, reviewer identity, scoped signed job ID and observed emulator result. Until those are present this is **source-only**.

Run focused checks: `node --test agents/repository-engine/android-security-lab.test.mjs`.
