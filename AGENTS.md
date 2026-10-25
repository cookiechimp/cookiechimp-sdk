# CookieChimp SDK project rules

- Work in `cookiechimp/cookiechimp-sdk`. Do not modify, merge, deploy or run writes against the CookieChimp platform repository.
- Platform dependencies require Daniel's review and action. Daniel authorized Codex to review, fix and merge the SDK PRs for this completion sequence on 14 Oct 2026, after their current-head checks pass. npm publication and external submissions still require his explicit approval.
- Follow `CONTRIBUTING.md`: clean-room implementation, no client-side geolocation (except the opt-in React Native `geolocation` option described there), no em dash characters, and all seven required CI checks on the current head.
- Keep `docs/remaining-work.md` accurate. Distinguish built and tested work from merged, deployed and published work.
- Live CookieChimp backend config retrieval and consent delivery are always required before npm publication, including releases that support local-only usage. Keep connected examples prominent; never waive this release gate to expedite publication.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
