# Remaining work and launch status (18 Oct 2026)

## Platform category and vendor UI (unreleased)

- The SDK PR adds an opt-in UI driven by the existing platform JSON, with
  vendor controls, privacy links and storage disclosures. The React/Vite
  example includes `/platform.html`.
- Styled interactions animate by default, with `motion={false}` and automatic
  reduced-motion support. The example uses realistic vendor purposes, company
  names, privacy links and illustrative cookie settings from the same JSON.
- This work is not merged or published. Website adoption depends on SDK review,
  current-head CI and the new package release.
- The live backend configuration and consent-delivery release gate still applies.

Daniel authorized Codex to review, fix and merge the SDK PRs on 14 Oct 2026.
All eight SDK PRs below are now merged into main after review and green checks.
Platform actions remain Daniel's responsibility; this SDK takeover has made
no platform changes. The eight 1.0.0 candidates are staged on npm for review,
not published as an installable SDK release.

## Merged

- M1 Core, M2 React, M3 Next.js, M4 Scripts and tooling: complete.
- M5 Connected mode, items 20 to 24: #26 sync, #27 consent log, #28 self-hosted
  endpoint, #29 CLI link/pull, #30 provider endpoint, #31 server config, #32 follow-ups.
- M6, items 25 to 27: #33 GPP, #34 TCF core/stub, #35 vendor UI, #36 GPP
  wiring, #37 vendor details and focus-safe windowing, #38 TCF translations.

## Reviewed and merged on 14 Oct 2026

| PR | Completed SDK work |
|---|---|
| [#41](https://github.com/cookiechimp/cookiechimp-sdk/pull/41) | React script ownership, duplicate prevention, ordered activation, typed CLI config and CSS generation from paths with spaces. Review also fixed queue ordering when a gate controller stops during an external load. |
| [#39](https://github.com/cookiechimp/cookiechimp-sdk/pull/39) | Static docs, llms files, four AI skills, both Next.js examples and a deployment artifact. Review corrected example commands to build SDK dependencies on a fresh clone. |
| [#42](https://github.com/cookiechimp/cookiechimp-sdk/pull/42) | Reproducible benchmarks, raw 10-run results and CI smoke checks. All 40 measured attempts and four excluded warmups passed on the recorded source commit. |
| [#44](https://github.com/cookiechimp/cookiechimp-sdk/pull/44) | Ten additional GPP state formats, reference conformance and browser persistence. All 16 US formats from the published IAB reference are supported. |
| [#45](https://github.com/cookiechimp/cookiechimp-sdk/pull/45) | Optional TCF provider, lazy loading, lifecycle/error handling and a Next.js head stub. Apps supply their CMP ID, GVL and authoritative feature decision. |
| [#46](https://github.com/cookiechimp/cookiechimp-sdk/pull/46) | Plain React/Vite example and local static docs search, including keyboard/mobile support, section links and safe fallback rendering. |
| [#47](https://github.com/cookiechimp/cookiechimp-sdk/pull/47) | Current GVL descriptions, illustrations, standard feature explanation and special-purpose-only vendor support. |
| [#43](https://github.com/cookiechimp/cookiechimp-sdk/pull/43) | Eight coordinated 1.0.0 candidates, licenses, changelogs, typed CSS exports, fresh-consumer validation and guarded provenance workflow. |

All seven required checks passed on each reviewed head. Benchmark smoke and
packed-consumer checks also passed where present. The review record is in
[SDK merge review](sdk-merge-review.md). Daniel selected the existing CookieChimp Mintlify docs repo for SDK documentation
on 14 Oct. Docs PR #76 and SDK PR #49 merged on 17 Oct. All 12 SDK guides,
Markdown views and the prefixed Mintlify AI indexes are live. npm publication
and external submission remain separate.

Base and TCF labels for all 33 locales completed AI editorial review on
17 Oct 2026. Corrections, method and exact source hashes are recorded in the
[review record](translation-review.md). This is not a native-speaker attestation.

## Launch preparation completed on 17 Oct 2026

- Daniel authorized public SDK source after the historical account identifier
  was disclosed. A targeted scan of 1315 unique Git blobs found no supported
  credential patterns. The SDK repository is public; its Git history was preserved.
- The existing free `@cookiechimp` npm organization belongs to `danielpaul`.
  Account 2FA and the local npm CLI login are verified.
- Daniel approved staging all eight `1.0.0` candidates. npm staging receipts
  match the SHA-512 integrity values in `release/artifacts/manifest.json`.
  npm displays public `0.0.0-stage` placeholder pages and the eight actual
  candidates in the review queue. This is not publication of `1.0.0`.
- GitHub environment `npm-publish` is restricted to main and requires
  `danielpaul` review. Daniel subsequently authorized publishing `1.0.0`.
- All eight npm GitHub trusted publisher connections are saved and verified
  through `npm trust list`: repository `cookiechimp/cookiechimp-sdk`, workflow
  `release.yml`, environment `npm-publish`, publishing and staging permissions.
  First successful CI publication must validate them within npm's two-day window.

## Launch gates requiring Daniel or external work

Live backend verification is always an npm publication requirement, even for
releases that support local-only usage. PR #52 proposing to remove that gate
was closed at Daniel's direction. The backend-connected React example and
[walkthrough](../packages/docs/content/connected-backend.md) make the config,
consent delivery and receipt checks reproducible; mocked CI is separate evidence.

- Platform [#2773](https://github.com/IdentitySquare/CookieChimp/pull/2773),
  consent idempotency, merged at 09:01 UTC, followed by
  [#2772](https://github.com/IdentitySquare/CookieChimp/pull/2772), shared web/mobile
  offline config, at 09:06 UTC on 17 Oct. Deployment `7137407395` succeeded at
  09:09 UTC for `bbe4feff688e60e65ce33b9ec9a4bdb6dbd00459`. Live connected
  config and consent-record delivery still require evidence from Daniel.
  Fixture tests and deployment success do not prove live record delivery.
- Complete the remaining checks in `release/readiness.json`, then run the guarded
  release workflow with `approved_version=1.0.0`. Publication must retain npm
  provenance; locally staged bootstrap candidates have no CI provenance and
  must not be promoted as the final provenance-verified release.
- External skill/Context7 registry publication and benchmark submission require
  review and explicit submission instructions. Files and the manifest are prepared.

## Deferred internal TODO

- Optional managed IAB registration, CMP ID assignment and validation are deferred
  at Daniel's direction. The placeholder stays unset; the [internal TODO](iab-integration-todo.md)
  is not exported to Mintlify and is not an SDK publication gate. Production TCF
  still requires valid explicit configuration, and the provider stays disabled by default.

## Integration gaps and intentional limitations

- TCF provider wiring is merged in #45. Real CMP registration, a GVL CDN/proxy
  and connected Pro entitlement enforcement remain external/platform requirements.
  Apps supply a vendor list or bounded loader to the optional provider.
- GPP now covers 15 state formats plus national. The newer MN/MD/IN/KY/RI
  formats (IDs 23 to 27) are absent from the published IAB reference and still use
  the national fallback. See [conformance and coverage](gpp-conformance.md).
- Consent records do not reach Tinybird; that remains platform-side work.
- No cc_pk_ validation: the platform deliberately treats account hashids as public.
- Dashboard copy with HTML uses the code message as a safe fallback.
- Page-hide requests with custom headers can be dropped by the browser. Persisted
  records retry on the next visit and require receiver deduplication.
- Sync is 2395 B, inside the revised 2.5 KB SPEC target. Provider headroom is about
  12%, below the 15% watch target; every enforced budget passes.
- The conservative TCF/GPP component sum is 10629 B of 12288 B. The provider
  bootstrap is 663 B and the deduplicated full IAB graph plus vendor CSS is 10354 B
  of 12288 B. All 41 enforced budgets pass, including default-bundle exclusion.
- The old unexplained e2e failure has not recurred. Failure traces are now retained
  and uploaded by CI so any recurrence can be investigated.

## Working rules

- Follow AGENTS.md and CONTRIBUTING.md. Never copy CookieYes code. No client-side geolocation.
- All seven checks must pass on the current head. Packed-consumer and benchmark
  checks provide additional validation. Separate local proof, CI, merge, deployment
  and registry publication when reporting status.
- The prior daily Drive cookiechimp-sdk build routine remains paused. No new recurring
  automation was created by this takeover; the active goal is doing the work here.
