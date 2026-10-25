> Historical launch record captured from SDK main `5b07c453` on 25 Oct 2026.
> Current tasks and review status live in [remaining work](remaining-work.md).
> Sizes and open-work statements below describe that release snapshot.

# Remaining work and launch status (25 Oct 2026)

## Platform category and vendor UI (published in 1.1.0)

- The SDK PR adds an opt-in UI driven by the existing platform JSON, with
  vendor controls, privacy links and storage disclosures. The React/Vite
  example includes `/platform.html` with 16 interactive presets, an isolated
  actual-SDK preview, desktop/mobile sizes, full controls, JSON export and
  saved-choice replay. No tracking tags or consent records are sent.
- Platform GUI/theme parity includes every designer layout/position, button
  placement/order/visibility, equal weight, themes, CSS-unit radii, logos, rich
  copy and forced interaction. See `platform-json-compatibility.md` for the
  presentation contract and explicit integration boundaries.
- Runtime consent snapshots always expose a complete `services` map, including
  before a decision. Values match effective category, vendor and GPC choices;
  inherited defaults are not persisted as explicit overrides.
- Saved consent with a different recorded regulation is ignored, including US
  opt-out choices when an EU opt-in banner is selected. Optional vendors return
  to the new mode's defaults until a fresh decision is saved.
- Consent language and RTL direction are scoped to the banner, preferences and
  recall control so application content keeps its own locale.
- Preferences have a divided header and a dedicated scrolling body. The header
  and action buttons remain visible in centered and side-panel layouts.
- The preferences footer separates Save preferences from the paired accept/reject
  actions. On narrow screens Save gets its own row and accept/reject stay together.
- The preferences modal shows the runtime consent ID above branding. This is
  the same value submitted as `uuid` by the platform consent-log integration,
  and persists with saved choices. Displaying it is not delivery confirmation.
- Styled interactions animate by default, with `motion={false}` and automatic
  reduced-motion support. The example uses realistic vendor purposes, company
  names, privacy links and illustrative cookie settings from the same JSON.
- This work merged in [SDK #54](https://github.com/cookiechimp/cookiechimp-sdk/pull/54)
  on 19 Oct 2026. All seven required checks passed on the publishing source.
  This UI is published in 1.1.0. Adoption in the hosted platform remains a
  separate action requiring Daniel's platform review.
- The 1.1.0 preparation also patches pinned Next.js development/example/consumer
  dependencies from vulnerable 16.4.0 to 16.4.3, consistently across benchmark
  comparators. Historical benchmark measurements retain their recorded versions.
- The live backend configuration and consent-delivery release gate still applies.

Daniel authorized Codex to review, fix and merge the SDK PRs on 14 Oct 2026.
All eight SDK PRs below are now merged into main after review and green checks.
Platform actions remain Daniel's responsibility; this SDK takeover has made
no platform changes. All eight 1.0.0 packages were published on 17 Oct 2026.
Registry inspection on 23 Oct confirms their integrity metadata but no advertised
provenance attestations. See `release/npm-1.0.0-audit.json`. All eight 1.1.0 packages
were published on 25 Oct through the protected GitHub OIDC workflow and are npm
`latest`. Registry integrity, provenance and fresh-install signature/browser
checks passed. See the [complete audit](../release/npm-1.1.0-audit.json),
[consumer evidence](release-evidence/2026-10-25-registry-consumer.json) and
[GitHub release](https://github.com/cookiechimp/cookiechimp-sdk/releases/tag/v1.1.0).

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
Markdown views and the prefixed Mintlify AI indexes were verified live on 17 Oct. Docs #79 consolidates the backend and platform UI guides into the same Mintlify
site. SDK package publication and docs deployment have separate verification records.

Base and TCF labels for all 33 locales completed AI editorial review on
17 Oct 2026. Corrections, method and exact source hashes are recorded in the
[review record](translation-review.md). This is not a native-speaker attestation.

## Launch setup and published releases

- Daniel authorized public SDK source after the historical account identifier
  was disclosed. A targeted scan of 1315 unique Git blobs found no supported
  credential patterns. The SDK repository is public; its Git history was preserved.
- The existing free `@cookiechimp` npm organization belongs to `danielpaul`.
  Account 2FA and CLI sign-in were verified on 17 Oct; reauthenticate if needed.
- Daniel approved staging and publication of 1.0.0. Registry inspection now
  confirms all eight actual 1.0.0 versions were published on 17 Oct, after
  initial staging. The earlier claim that they remain only staged is obsolete.
- GitHub environment `npm-publish` is restricted to main and requires
  `danielpaul` review. Daniel subsequently authorized publishing `1.0.0`.
- Daniel authorized renewal of all eight expired npm trusted publisher
  connections on 24 Oct. All eight were recreated and verified with the same
  repository, workflow, environment and publish/stage permissions; the
  [connection audit](../release/npm-trusted-publishers-2026-10-24.json) records
  one connection per package. `npmOrganizationReady` is true for this setup.
  Renewal itself published no version. All eight connections subsequently
  completed a trusted publish on 25 Oct, satisfying their first-publish deadlines.
  Daniel approved 1.1.0 from `8d68ddb` and recovery publication/deployment review
  from `8e1c037`. GitHub's environment still requires Daniel's review and permits
  only main.

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
  config and consent-record delivery were verified on 24-25 Oct as recorded below.
  Fixture tests and deployment success alone do not prove live record delivery.
  On 24 Oct Daniel selected cookiechimp.com's public account `K8ktWD` for testing.
  Live browser config, accept/reject/custom delivery, persistence and blocked
  retry checks passed at `http://localhost:3104`, with four matching HTTP 200
  receipts and an empty queue. The [evidence](release-evidence/2026-10-24-live-backend.json)
  records exact decision and server IDs. Authenticated dashboard inspection on
  25 Oct confirmed exactly four matching stored records, their saved preferences
  and one retry record. `platformDeployed` is true for this evidence. The
  [live test runbook](live-backend-verification.md) records the completed checks.
- [SDK #55](https://github.com/cookiechimp/cookiechimp-sdk/pull/55) merged on 23 Oct
  after current-head checks passed. Main CI and prepare-only release run
  `40036259290` passed on `bcee50436707e27f9f5f38f7ef6a4c4f3baafb1e`;
  all eight candidate tarballs passed hash/integrity verification and the
  installed consumer checked 116 exports. Publication was skipped. Candidate
  manifests bind version, package hashes and exact source commit.
- Docs #79 now consolidates the backend guide from #78 and the platform guides
  in one clean 14-page export. Duplicate #78 was closed after the preserved
  import passed validation. Public guides describe the SDK in present tense and
  state package version requirements; internal publication gates remain here and
  in `release/readiness.json`. Mintlify deployment is verified separately.
- Live backend evidence is complete. SDK #62 fixed npm 12 metadata normalization
  and registry propagation handling. Daniel approved recovery source `8e1c037`
  and its deployment review. Release run #8 verified/skipped the identical token
  version and published the remaining seven 1.1.0 packages. All registry bytes,
  expected provenance sources and npm signatures were verified. A fresh npm
  consumer checked 116 exports, a production build, CLI help, standard/platform
  consent, gated scripts, mixed vendor choices, withdrawal and reload persistence.
  The [GitHub release](https://github.com/cookiechimp/cookiechimp-sdk/releases/tag/v1.1.0)
  contains the tarballs and evidence. The public release-status sources are updated;
  the docs repository import and Mintlify deployment are verified separately.
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
- Standard connected UI uses code-label fallbacks for dashboard HTML. The opt-in
  platform UI renders its bounded safe rich-text subset.
- Page-hide requests with custom headers can be dropped by the browser. Persisted
  records retry on the next visit and require receiver deduplication.
- All 42 enforced budgets pass. Sync is 4098 B against its 4355 B standalone
  limit. Its remeasured marginal cost over core is 3069 B, exceeding the older
  SPEC 2.5 KB target by 509 B. That target needs optimization or an explicit
  reviewed decision; no limit was changed by release preparation. The previous
  claim of a current 2395 B marginal cost was stale. See [size methodology](size.md).
- The conservative TCF/GPP component sum is 10629 B of 12288 B. The provider
  bootstrap is 663 B and the deduplicated full IAB graph plus vendor CSS is 10354 B
  of 12288 B. The 1.1.0 validation passes all 42 enforced budgets, including the new
  platform UI graph and default-bundle exclusion.
- The old unexplained e2e failure has not recurred. Failure traces are now retained
  and uploaded by CI so any recurrence can be investigated.

## Working rules

- Billing counts all users, including bots. The obsolete bot analytics, consent
  retention and billing PR stack is not a prerequisite for the SDK launch.
- Follow AGENTS.md and CONTRIBUTING.md. Never copy CookieYes code. No client-side geolocation.
- All seven checks must pass on the current head. Packed-consumer and benchmark
  checks provide additional validation. Separate local proof, CI, merge, deployment
  and registry publication when reporting status.
- The prior daily Drive cookiechimp-sdk build routine remains paused. No new recurring
  automation was created by this takeover; the active goal is doing the work here.
