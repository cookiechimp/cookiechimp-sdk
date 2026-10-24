# Coordinated SDK release preparation

All eight `@cookiechimp` 1.0.0 packages were published on 17 October 2026.
The registry snapshot in `release/npm-1.0.0-audit.json`, checked on 23 October,
records their integrity and lack of advertised provenance attestations. Published
versions cannot be overwritten. This branch prepares the new 1.1.0 release.

## What changes in 1.1.0

The opt-in platform JSON UI, category/vendor choices, storage disclosures,
GUI/theme variants and playground merged in SDK #54 on 19 October. The release
also includes complete effective service snapshots, consent invalidation across
regulations and consent UI locale isolation. The new React platform entry and
stylesheet are absent from npm 1.0.0. See each package's changelog and
[the draft release notes](releases/1.1.0.md).

## Package and inspect

```sh
pnpm install --frozen-lockfile
pnpm build
# Commit reviewed source changes before creating source-bound tarballs.
pnpm release:pack
pnpm release:check
```

`release/artifacts/` contains eight tarballs and a manifest with the coordinated
version, source commit, SHA-256 and npm SHA-512 integrity hashes. Packing requires a clean committed checkout and always
builds current source, checks every export/bin target and release document,
rejects unintended files and unresolved workspace dependencies, and preserves
dependency-first publication order. Consumer validation and publishing reject
candidates for another version, source commit or package cohort.

Tests, fixtures, credentials, Codex logs and benchmark comparators cannot enter
the package allowlist. React stylesheet exports include types and are marked as
side effects so consumer bundlers retain CSS. Package installs are also tested
outside the workspace with `pnpm release:consumer`.

PR CI installs the tarballs in an isolated consumer, checks all public entries,
validates standalone declarations strictly and exercises a Next.js production app
in Chromium. It covers standard consent, script gating, persistence, TCF/GVL and
the new platform vendor UI, disclosures and saved vendor choices. Next.js
declaration dependencies use its normal `skipLibCheck` setting; standalone SDK
declarations are checked with it disabled.

The manual **SDK release** workflow defaults to `prepare`. It reruns validation
and saves `sdk-candidate-<source-sha>` without publishing. Its artifact and publish
steps read the configured release version instead of assuming 1.0.0.

## Outstanding publication requirements

- Daniel requested live test preparation on 24 October after deferring the test
  on 23 October. The connected page is prepared; real results remain pending. Keep
  `manualChecks.platformDeployed` false until reviewed test-account evidence
  proves config retrieval, accept/reject/custom delivery, matching receipts,
  platform records, persistence and retry behavior. The exact inputs and steps
  are in [the live backend runbook](live-backend-verification.md). Deployment of
  platform #2773/#2772 alone is not delivery proof. SDK work performs no platform
  writes; Daniel owns platform configuration and live consent submissions.
- Authenticated npm inspection on 24 October found all eight trusted publisher
  connections expired. Restore and verify their existing bindings to
  `cookiechimp/cookiechimp-sdk`, `release.yml`, environment `npm-publish`, with
  publish/stage permissions before setting `npmOrganizationReady` true. Use
  GitHub OIDC and provenance for 1.1.0; do not promote old bootstrap artifacts.
- Obtain explicit approval for version 1.1.0. The previous approval for 1.0.0
  does not carry to another version. The `npm-publish` environment must retain
  Daniel's required review and main-only branch policy.
- Docs #79 and #81 are merged and deployed, including the connected-backend
  guide and the all-users billing policy. Public guides use present-tense copy
  with SDK version requirements. Verify the public guides against the final
  published package behavior as part of release verification.

The SDK source repository is public. Organization ownership, account 2FA and
public source history review were completed on 17 October. All 33 base/TCF
locales completed AI editorial review; exact hashes are recorded in
[the translation review](translation-review.md). Optional managed IAB activation
remains a separate [internal TODO](iab-integration-todo.md), not a publication gate.

## Publish after evidence and approval

From reviewed main with all seven required checks green, run **SDK release**,
choose `publish` and enter `1.1.0` as `approved_version`. The workflow verifies
prerequisites before reaching Daniel's environment review. It confirms the source
SHA is still main, publishes the exact prepared tarballs with npm OIDC and
provenance, and verifies registry integrity and attestations for every package.
A partial rerun skips an existing version only when its bytes and provenance
match. A mismatched or unattested existing version is rejected.

After registry verification, install the published packages in a fresh Next.js
app, exercise standard and platform consent/persistence in a browser, and run
`npm audit signatures`. Update the public release-status guide, then publish the
reviewed GitHub release/tag using [the prepared notes](releases/1.1.0.md).
The workflow does not create tags or claim publication or live tests occurred.
External skill/Context7 and benchmark submissions remain separately approved work.

Canonical SDK guides belong on the existing CookieChimp Mintlify site. No new
hosting/domain is required. See [the documentation workflow](documentation.md).
