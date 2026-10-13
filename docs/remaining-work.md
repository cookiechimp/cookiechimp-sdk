# Remaining work and launch status (13 Oct 2026)

Daniel resumed this project on 13 Oct 2026. SDK pull requests require his review
before merge. Platform work is limited to PR preparation and Daniel's action;
this SDK takeover has made no platform changes.

## Merged

- M1 Core, M2 React, M3 Next.js, M4 Scripts and tooling: complete.
- M5 Connected mode, items 20 to 24: #26 sync, #27 consent log, #28 self-hosted
  endpoint, #29 CLI link/pull, #30 provider endpoint, #31 server config, #32 follow-ups.
- M6, items 25 to 27: #33 GPP, #34 TCF core/stub, #35 vendor UI, #36 GPP
  wiring, #37 vendor details and focus-safe windowing, #38 TCF translations.

## Built and ready for Daniel review

Review in dependency order; none of these SDK PRs has been merged by this takeover.

1. [#41](https://github.com/cookiechimp/cookiechimp-sdk/pull/41): React gating
   reconciliation, duplicate execution and ordered activation fixes, typed CLI
   config, and CSS generation from paths containing spaces. All seven CI checks green.
2. [#39](https://github.com/cookiechimp/cookiechimp-sdk/pull/39), item 28:
   documentation site, llms files, four AI skills, examples for both Next.js
   routers, snippet checks and a static deployment artifact. All seven CI checks green.
3. [#42](https://github.com/cookiechimp/cookiechimp-sdk/pull/42), item 29:
   reproducible benchmarks, raw 10-run results and CI smoke checks. All 40 measured
   attempts and four excluded warmups passed locally. Seven standard CI checks and
   benchmark smoke are green. Results identify the clean measured source commit.
4. [#44](https://github.com/cookiechimp/cookiechimp-sdk/pull/44): ten additional
   GPP state formats with reference conformance and browser persistence. The SDK
   supports all 16 US sections in the published IAB reference. Local validation passes;
   all seven standard CI checks and benchmark smoke are green.
5. [#45](https://github.com/cookiechimp/cookiechimp-sdk/pull/45): optional TCF
   provider wiring, lazy core loading, readiness/error handling and a Next.js head
   stub. Requires the application's registered CMP ID, GVL and server-owned feature
   decision. Local lifecycle and production browser tests pass; all seven standard
   CI checks and benchmark smoke are green.
6. [#43](https://github.com/cookiechimp/cookiechimp-sdk/pull/43), item 30 release preparation: eight coordinated 1.0.0 candidates, public npm
   metadata, licenses, changelogs, typed stylesheet exports and a reviewed publication
   workflow. Local packaging and a fresh npm-installed Next.js consumer pass:
   114 entries, ESM/CJS, CSS, acceptance, persistence and React reconciliation.
   See [release validation](release-validation.md) and [release procedure](release.md).
   Publication is blocked by the actual prerequisites below.

## Launch gates requiring Daniel or external work

- Review and merge the SDK PRs in order, after their final-head checks pass.
- Platform [#2773](https://github.com/IdentitySquare/CookieChimp/pull/2773),
  consent idempotency: Daniel merges first. Then
  [#2772](https://github.com/IdentitySquare/CookieChimp/pull/2772), shared web/mobile
  offline config, schema version, 304/ETag and caching/CORS headers. Verify deployment
  and real connected config/record delivery. #2772 currently has a failed rspec
  check; Daniel must resolve/review it before merging. Before deployment website accounts
  may get 403 and use cached or in-code fallback. Fixture tests do not prove live delivery.
- Native-speaker review: 29 draft base locales and 32 draft TCF locales.
  [Review map](translation-review.md). Existing review flags have not been invented.
- Real CookieChimp IAB CMP registration/ID and manual validator checks. Production
  TCF remains disabled without a valid cmpId; GPP's default CMP ID remains 0.
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

- TCF provider wiring is built in #45. Real CMP registration, a GVL CDN/proxy
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
- The conservative TCF/GPP component sum is 10366 B of 12288 B. The provider
  bootstrap is 666 B and the deduplicated full IAB graph plus vendor CSS is 10127 B
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
