# SDK 1.1.0 preparation validation (23 October 2026)

This records local release preparation. The packages are not published, live
backend verification is deferred and the publication check remains blocked.

- All eight public package manifests/changelogs are versioned at 1.1.0 using
  the existing fixed Changesets cohort. The source platform UI merged in #54.
- Lint, type checks and all package/tool unit suites pass, including the new
  candidate version/source/cohort checks and the exact-version approval guard.
- All 283 component tests and 130 browser tests pass. Browser tests use installed
  Chrome and mock the CookieChimp endpoints; no live consent records are sent.
- All 42 enforced size budgets pass; none is pending. The platform UI graph is
  21249 B against its 24576 B budget on this local build.
- A separate marginal-size audit found sync adds 3069 B over core, exceeding
  the older 2.5 KB SPEC target by 509 B. Its standalone 4098 B measurement is
  within the enforced 4355 B limit. The documentation now records the gap for
  optimization or a reviewed target decision; no size limit was relaxed.
- Next.js pins in development/examples/fixtures/benchmark applications and the
  release consumer are updated to 16.4.3 after official advisories identified
  16.4.0 as affected. `pnpm audit` reports zero advisories at all severity levels.
  Historical benchmark runs retain the versions under which they were measured.
- The actual `release:check --publish` rejects the pending `platformDeployed`
  gate even when supplied the matching version input. This negative check did
  not approve or publish anything.

Packing requires clean committed source. The exact source SHA, eight tarball
SHA-256/SHA-512 hashes and installed-consumer proof are retained in the PR's
`sdk-candidate-and-consumer-proof` artifact. Inspect `manifest.json` and
`consumer-validation.json` from the current head; the consumer also checks the
public core VERSION against installed package metadata. Those generated records
cover standard consent, CSS, ESM/CJS, declarations, TCF/GVL and the platform UI's
vendor disclosures, saved vendor choices and consent UUID. Local artifacts live
in the ignored `release/artifacts/` directory after packing/consumer validation.

Docs are generated separately from a clean committed SDK checkout and imported
into Docs #79. Source provenance is recorded in its `sdk/source.json`. Duplicate
#78 was closed after its connected guide was preserved and validated in #79.
Mintlify validation/deployment and live backend evidence remain separate checks.

Still required before publication: review and merge, real backend evidence,
revalidation of npm trusted publishers, explicit approval of version 1.1.0,
Daniel's protected environment approval, then registry provenance verification
and a fresh installed-package browser/signature check. The exact live inputs
and test cases are in [the runbook](live-backend-verification.md).
