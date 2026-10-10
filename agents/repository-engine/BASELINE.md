# Shared robot runtime baseline

Every repository-engine invocation checks Node 22+, Git, Python, Playwright and its installed Chromium executable before claiming work. The report distinguishes local installation checks from authenticated remote operations. GitHub credentials, queue access and model execution are checked by their actual executor calls. Unimplemented deployment and fork connections and unverified wallet/catalog/image connections are reported explicitly.

For native Node fallback tests, the executor preloads node-test-globals.mjs using Node's --import option. It exposes Node's real describe, it, test and lifecycle hooks. Assertion failures remain failures. It does not provide Jest expect, mocks, DOM environments or fake compatibility layers. A repository with a configured test script uses its own framework rather than the fallback. Package dependencies install before any tests run.

The hosted setup pins Playwright and provisions its browser on every run. Secrets are injected at runtime through the GHP Actions secret and GitHub runner identity; no secret belongs in a container image or dependency bundle. No Oracle ODA/OIC SDK is required by this custom Cloudflare/GitHub system.

This baseline prevents the known Node-global and local installation problems. It cannot preinstall every future library or grant remote permissions. New languages, frameworks and services still require a declared implementation and a successful operation before their connection is marked verified.
