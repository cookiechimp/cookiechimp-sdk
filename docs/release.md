# Coordinated SDK release 1.2.0

All nine `@cookiechimp` packages are npm `latest` **1.2.0**, published on
27 October 2026 from `150b0292be3502b355bf0a0f00118d7c557db340` through
[the protected GitHub release run](https://github.com/cookiechimp/cookiechimp-sdk/actions/runs/40504134674).
See [release notes](releases/1.2.0.md), [the manifest](../release/npm-1.2.0-manifest.json)
and [the registry audit](../release/npm-1.2.0-audit.json).

- All seven required checks and packed web/native consumers passed before publication.
- Registry SHA-256/SHA-512 bytes and provenance match the immutable source,
  expected repository, workflow, main ref and release-run invocation for all nine
  packages. Recovery verified and skipped the identical first four uploads.
- [Fresh npm consumers](release-evidence/2026-10-27-registry-consumer.json) passed
  116 web exports, declarations, ESM/CJS, Next.js production build and browser
  consent/vendor persistence. The native consumer passed Expo types and both
  iOS/Android Hermes exports. Both `npm audit signatures` runs passed with no
  invalid or missing signatures.
- Daniel confirmed device checks and live consent delivery on 27 October.
  The [attestation](release-evidence/2026-10-27-native-confirmation.json) records
  exactly what was supplied. Codex did not inspect device build details or
  receipt/dashboard captures; automated consumers submitted no platform records.
- [Native npm setup](../release/npm-react-native-trusted-publisher-2026-10-27.json)
  is complete. The temporary bootstrap stage was rejected after publication,
  no stages remain, and the temporary version was never published.
- Canonical SDK guide sources describe 1.2.0. Importing those sources into
  CookieChimp-Docs and verifying Mintlify deployment remains separate work.

## Publish from a GitHub release

After merging the versioned release candidate and waiting for main CI, create a
GitHub release with the next version tag, for example `v1.3.0`, targeting the
current main commit and click
**Publish release**. Drafts, prereleases and tag pushes alone do not publish npm
`latest`. The tag must exactly match `release/readiness.json` and package versions.

`release-published.yml` validates the stable release and dispatches the existing
`release.yml` workflow on main, passing the exact version, source SHA and tag.
This preserves npm's existing trusted publisher and the main-only `npm-publish`
environment. The publication workflow rebuilds, tests and checks packed web and
native consumers, then waits for Daniel's GitHub environment approval. After
approval it rechecks main, the released tag, required CI and package readiness,
then publishes the exact tarballs through GitHub OIDC with provenance.

No npm CLI sign-in or security key is needed for routine OIDC publishes. Each
new npm package still needs its initial registry setup and trusted-publisher
binding. The native binding was configured on 27 October; the existing eight
packages already use trusted publishing. Publishing a GitHub
release does not bypass a pending readiness check or environment review.

If main or the tag moves before publication, the workflow refuses the changed
source. Keep main at the release commit until the publish finishes. The Actions
page shows the initial release trigger and the separate SDK release run; only a
successful publish job plus registry verification proves npm publication.

Manual `prepare` and approved `publish` dispatches remain available for recovery.
When rerunning a release-triggered publication, retain its `approved_source` and
`release_tag` inputs. Check the Actions publish result before announcing the
release as available on npm, then verify registry bytes/provenance and fresh
consumers as described below.

## Previous published release: 1.1.0

The previous eight `@cookiechimp` packages were published at **1.1.0** on
25 October 2026. The [GitHub release](https://github.com/cookiechimp/cookiechimp-sdk/releases/tag/v1.1.0)
contains the exact tarballs, manifest, registry audit and fresh-consumer evidence.

Daniel approved the original source `8d68ddb` and the recovery source
`8e1c0375ff90bc6ac1328479970842ea92c47efc`, including the protected deployment
review. The original run published the token package. Recovery
[run #8](https://github.com/cookiechimp/cookiechimp-sdk/actions/runs/40180633789)
verified and skipped that identical tarball, then published the other seven.
[The complete audit](../release/npm-1.1.0-audit.json) records each package's actual
provenance source. Runtime code, types and styles match the original candidate.

The earlier 1.0.0 cohort was published on 17 October. Its historical registry
snapshot remains in `release/npm-1.0.0-audit.json`; published versions cannot be
overwritten. The [partial 1.1.0 snapshot](../release/npm-1.1.0-partial-audit-2026-10-25.json)
records the earlier interrupted attempt, not the final release state.

## What changes in 1.1.0

The opt-in platform JSON UI, category/vendor choices, storage disclosures,
GUI/theme variants and playground merged in SDK #54 on 19 October. The release
also includes complete effective service snapshots, consent invalidation across
regulations and consent UI locale isolation. The new React platform entry and
stylesheet are absent from npm 1.0.0. See each package's changelog and
[the release notes](releases/1.1.0.md).

## Package and inspect

```sh
pnpm install --frozen-lockfile
pnpm build
# Commit reviewed source changes before creating source-bound tarballs.
pnpm release:pack
pnpm release:check
```

`release/artifacts/` contains nine tarballs and a manifest with the coordinated
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

## Completed 1.1.0 release gates

- Live browser config, accept/reject/custom consent delivery, matching receipts,
  persistence and blocked-request retry passed using Daniel-selected account
  `K8ktWD`. Authenticated dashboard inspection confirmed exactly four matching
  stored records and their preferences. See the
  [live backend evidence](release-evidence/2026-10-24-live-backend.json) and
  [runbook](live-backend-verification.md). No platform repository or account
  settings were changed.
- All eight renewed trusted-publisher bindings were reconfirmed on 25 October.
  Each has now completed a successful GitHub OIDC publish. The main-only
  `npm-publish` environment retains Daniel's required review.
- All eight registry tarballs match the
  [publishing manifest](../release/npm-1.1.0-manifest.json). Their provenance
  identifies the expected repository, workflow, main ref, source and invocation.
  `npm audit signatures` passed in a fresh npm installation.
- The [fresh registry consumer](release-evidence/2026-10-25-registry-consumer.json)
  verified all 116 exports, strict standalone declarations, core `VERSION`, a
  Next.js 16.4.3 production build and both HTTP routes. Browser checks covered
  standard accept/reject, gated scripts, mixed vendor choices, disclosures,
  withdrawal, stable consent IDs and reload persistence, with no console errors.
  The installed CLI help command passed. These local consumer checks submitted
  no additional platform records; the live backend evidence is recorded separately.
- Canonical public guide sources now identify 1.1.0 as available on npm. Import
  the clean committed export into the docs repository and verify its separate
  Mintlify deployment. Docs #79 and #81 already include connected-backend guidance
  and the all-users billing policy.

The SDK source repository is public. Organization ownership, account 2FA and
public source history review were completed on 17 October. All 33 base/TCF
locales completed AI editorial review; exact hashes are recorded in
[the translation review](translation-review.md). Optional managed IAB activation
remains a separate [internal TODO](iab-integration-todo.md), not a publication gate.

## Future releases and recovery

Do not republish 1.2.0 or an earlier version from a later commit. For a new release, update every coordinated
package version, changelogs and `release/readiness.json`, review current live
backend evidence, and obtain explicit approval of the new version and source.
From reviewed main with all seven required checks green, publish the new stable
GitHub release to dispatch the protected workflow. Manual recovery can choose
`publish` in **SDK release** with the exact version as `approved_version`.

The workflow requires Daniel's protected-environment review, confirms the source
SHA is still main and publishes the exact prepared tarballs with GitHub OIDC and
provenance. Recovery normalizes npm's object/single-item-array metadata and skips
an existing version only when its bytes and provenance match. Mismatched or
unattested existing versions fail. Newly acknowledged uploads receive up to five
minutes of metadata/provenance polling, with each registry command limited to
15 seconds; integrity mismatches and non-404 errors fail immediately.

After publication, verify registry bytes/provenance, install from npm in a fresh
consumer, run signature auditing and browser checks, and attach evidence to the reviewed
GitHub release/tag. Keep the public release-status guide and
internal launch record current. External skill/Context7 and benchmark submissions
remain separately approved work.

Canonical SDK guides belong on the existing CookieChimp Mintlify site. No new
hosting/domain is required. See [the documentation workflow](documentation.md).

## New-package staging recovery

A new package may need an unapproved staging upload to establish its npm
identity before trusted publishing can be configured. Use a separate temporary
version and tag, explicitly approved for this bootstrap purpose; never approve
or publish that temporary version as an SDK release. Keep it staged until the
real GitHub OIDC publication succeeds and its registry bytes/provenance are verified.

Staging the actual release version blocks direct OIDC publication with npm E409.
If this happens, retain a separate temporary stage before rejecting the conflicting
release-version stage. Removing the only staged version before any real version
is published can remove the unpublished package identity and its publisher binding.
Verify the intended trusted publisher and retry the protected workflow with the
same approved source/tag. After the real publication is verified, reject the
temporary stage and confirm the stage list is empty. The completed native
[setup record](../release/npm-react-native-trusted-publisher-2026-10-27.json)
documents this recovery without credentials.
