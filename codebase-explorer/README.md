# Bubbles Codebase Explorer — public source map (milestone 1)

This is a small, **read-only** source map, not Makepad Scope and not a Chromium or Makepad fork. The X demo shown by Rik Arends uses unreleased Makepad Scope. The public MIT-licensed Makepad framework may be considered for a future native renderer, but no third-party code is bundled here.

The current page uses the GitHub REST API without a key to read one exact `main` commit SHA and its repository tree for `www-infinity4/Moltnook`, `www-infinity4/QuantaPhi` or `makepad/makepad`. It computes directory groups from GitHub-reported blob sizes and provides accessible file navigation with immutable revision links. It does not download full source contents, run code, infer symbol relations, access private repositories, open issues, write files, or make agent calls. Truncated GitHub results and API errors remain visible.

Acceptance:
- `node --test codebase-explorer/explorer-core.test.mjs`
- `node --check codebase-explorer/explorer-ui.mjs`
- Public browser testing on Android widths and GitHub API access still required before claiming site acceptance
- This is only a UI/source-inspection milestone; the real Bubbles signed executor is unchanged

Related owner work: https://github.com/www-infinity4/QuantaPhi/issues/1907 ; prior parallel reader: https://github.com/www-infinity4/Moltnook/pull/252 .