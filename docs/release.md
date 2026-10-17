# 1.0 release preparation

The eight `@cookiechimp` packages are a coordinated 1.0.0 candidate, not a
published release. SDK PR review and npm publication approval are separate.

## Package and inspect

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm release:pack
pnpm release:check
```

`release/artifacts/` contains eight tarballs and a manifest with SHA-256 and
npm SHA-512 integrity hashes. Packaging checks each export/bin target, license,
README and changelog, refuses unintended files and unresolved workspace dependencies,
and preserves dependency-first publication order. Tests, fixtures, credentials,
Codex logs and benchmark comparators cannot enter the package allowlist.
The React stylesheet exports include types and are marked as side effects so
consumer bundlers retain CSS. Package installs must also be tested outside this
workspace before publication.

PR CI also installs the tarballs in an isolated consumer, checks 114 public entries,
validates standalone declarations strictly, and exercises the Next.js production
app in Chromium. Next.js declaration dependencies use its normal `skipLibCheck`
setting; the standalone SDK declarations are checked with it disabled.

The manual **SDK release** workflow defaults to `prepare`. It reruns all
validation and saves the `sdk-1.0.0-candidate` artifact without publishing.

SDK PRs #41, #39, #42, #44, #45, #46, #47 and #43 were reviewed and merged
on 14 Oct 2026 under Daniel's authorization. All seven required checks passed
on each final reviewed head. Publication approval remains separate.

Base and TCF copy for all 33 locales completed AI editorial review on
17 Oct 2026. The [review record](translation-review.md) identifies the method,
reviewer and exact source hashes. Keep that evidence current when copy changes.

## Still required

- Daniel handles platform #2773 then #2772, and verifies deployment and actual
  connected config/consent delivery. SDK work never merges platform PRs.
- Optional CookieChimp-managed TCF activation is deferred to the
  [internal IAB TODO](iab-integration-todo.md). It is not an SDK publication gate.
  Production TCF still requires valid explicit configuration; no runtime check is bypassed.
- The source repository is currently private. npm provenance requires a public
  source repository. Before making it public, Daniel must review source history:
  removed `error.log` remains in commit `7b90f7c` and contained a ChatGPT account
  identifier (not a token). Package allowlists exclude that file. No history or
  repository visibility change has been made by this work.
- Daniel supplies npm organization access. This machine is unauthenticated.
  Configure trusted publishing for `cookiechimp/cookiechimp-sdk`, workflow
  `release.yml`, environment `npm-publish`, with direct npm publish allowed.
  New packages may require an authorized first publication before trusted
  publisher settings are available; inspect npm's current setup flow before it.
- Configure the GitHub environment `npm-publish` to require `danielpaul` review.
  The workflow verifies that protection exists before permitting its publish job.
- Complete `release/readiness.json` with evidence, then Daniel explicitly
  approves publication of version `1.0.0`. `release:check --publish` deliberately
  fails while any prerequisite or editorial locale review remains outstanding.

## Publish after approval

Run the **SDK release** workflow from main, choose `publish`, and enter `1.0.0`
as `approved_version`. Its environment checkpoint requires Daniel review.
The source SHA must still be main and all seven CI checks must be green.
The publish job uses npm OIDC, publishes the exact prepared tarballs with
provenance, and verifies registry integrity and attestations for every package.
A partial rerun skips an existing version only when its bytes and provenance match.
It refuses an existing mismatched version; npm versions cannot be overwritten.

After registry verification, install the published packages in a fresh Next.js
app, exercise consent and persistence in a browser, and verify provenance with
`npm audit signatures`. Then prepare a reviewed GitHub release/tag and external
benchmark submission. The workflow does not claim those steps have happened.

Daniel selected the existing CookieChimp Mintlify site for SDK guides. The
documentation PR #76 and SDK PR #49 merged on 17 Oct 2026; all 12 SDK routes
and the Mintlify AI indexes were verified live. See [documentation workflow](documentation.md).

Sources: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)
and [npm provenance](https://docs.npmjs.com/generating-provenance-statements/).
