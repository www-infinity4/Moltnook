# Linux job workspace

Use the existing GitHub Actions Ubuntu runner for cloud build jobs. Cloudflare Workers execute JavaScript requests; a Worker cannot become a Linux shell by loading instructions. Probe node --version, python3 --version, git --version and gh --version and retain their actual outputs.

Create one temporary directory per job. Run fixed executable/argument arrays without a shell, set deadlines, and check exit status. Never execute model-proposed shell with owner credentials. Source parsing/checks receive a credential-free environment; only the fixed GitHub adapter receives the existing token. Delete only the verified job directory in finally, preserving user files and installed reusable tools. A Python HTTP server is a local preview and does not establish public hosting.

Source: https://docs.github.com/en/actions/reference/runners/github-hosted-runners

