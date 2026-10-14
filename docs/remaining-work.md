# Remaining work and launch status (14 Oct 2026)

Daniel authorized Codex to review, fix and merge the SDK PRs on 14 Oct 2026.
All eight SDK PRs below are now merged into main after review and green checks.
Platform actions remain Daniel's responsibility; this SDK takeover has made
no platform changes. The 1.0.0 packages are prepared, not published.

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
[SDK merge review](sdk-merge-review.md). Docs hosting/domain remain undecided,
as requested. npm publication, deployment and external submission are separate.

## Launch gates requiring Daniel or external work

- Platform [#2773](https://github.com/IdentitySquare/CookieChimp/pull/2773),
  consent idempotency: Daniel merges first. Then
  [#2772](https://github.com/IdentitySquare/CookieChimp/pull/2772), shared web/mobile
  offline config, schema version, 304/ETag and caching/CORS headers. Verify deployment
  and real connected config/record delivery. #2772 currently has a failed rspec
  check; Daniel must resolve/review it before merging. Before deployment website accounts
  may get 403 and use cached or in-code fallback. Fixture tests do not prove live delivery.
- Native-speaker review: 29 draft base locales and 32 draft TCF locales.
  [Review map](translation-review.md). Existing review flags have not been invented.
- Confirm the existing CookieChimp IAB registration status and assigned CMP ID,
  then complete current manual validator checks. Verify prior registration status
  before starting another application. Production TCF remains disabled without a
  valid cmpId; GPP's default CMP ID remains 0. Current GVL disclosure support was
  merged in #47 for the 23 October 2026 web deadline; formal approval is not claimed.
- The GitHub source repository is private. Public source is needed for npm provenance.
  Review source history before any visibility change: removed error.log in commit
  7b90f7c contained a ChatGPT account ID, not a token. No history rewrite or visibility
  change has been made. That file cannot enter the package allowlists.
- npm organization access and trusted publishing setup. This machine was not
  authenticated at takeover. Explicit approval of the exact version is required;
  release:check --publish fails while requirements or locale reviews remain pending.
- Docs hosting/domain: Daniel chose to prepare deployment and decide hosting later.
  The static CI artifact is prepared; no deployment has been performed.
- External skill/Context7 registry publication and benchmark submission require
  review and explicit submission instructions. Files and the manifest are prepared.

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
- The conservative TCF/GPP component sum is 10624 B of 12288 B. The provider
  bootstrap is 663 B and the deduplicated full IAB graph plus vendor CSS is 10347 B
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
