# 1.0 candidate validation (13 Oct 2026)

The eight local tarballs are prepared and validated, not published. Their
SHA-256 and npm integrity hashes are in `release/artifacts/manifest.json`;
CI retains the candidates and consumer proof as an artifact.

- Build, lint, typecheck and full unit suites passed.
- Component suite: 222 passed. Browser suite: 106 passed.
- Size harness: all 39 enforced budgets passed; TCF/GPP total remains
  10366 B against the 12288 B cap.
- Packaging: eight 1.0.0 tarballs with MIT licenses, READMEs and changelogs;
  all export/bin targets exist and workspace dependencies are converted.
- Fresh npm consumer: all eight packages installed as real tarballs, with
  no SDK workspace symlinks. 113 public entries resolve. Standalone SDK
  declarations pass strict checking with `skipLibCheck: false`; Next.js
  dependencies use its normal declaration-check policy. ESM/CJS entries
  load, and a Next.js 16.4.0 / React 19.3.0 production app builds.
- Chromium 155.0.8059.40: CSS loads, scripts stay blocked before consent,
  acceptance enables the gated script once, sibling insertion/removal does
  not crash React, consent survives reload without a banner, and preferences
  reopen. No page errors occurred. These checks cover the tested versions;
  they do not certify every declared peer version.
- Publication guard: `release:check --publish` exits nonzero for the actual
  outstanding prerequisites. No npm publish command was run.

Remote checks are verified on the PR's final head separately. Publication,
provenance, a GitHub release/tag, deployment and external benchmark submission
remain distinct steps requiring their recorded prerequisites and Daniel review.
