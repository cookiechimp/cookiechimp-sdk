# CookieChimp Consent SDK: Spec and Plan

Status: draft v0.1 (2026-10-12). Clean-room build. The CookieYes SDK (MIT) was inspected only for features, behaviour and API surface. No code is copied. Contributors must not paste or port code from that repo.

## 1. Competitor inventory (CookieYes Consent SDK)

| Area | What they ship |
|---|---|
| Packages | `@cookieyes/core` (exports `.`, `./iframes`, `./network-blocker`), `react`, `nextjs` (`.`, `./server`, `./styles-route`, CSS), `scripts`, `devtools`, `cli`, `translations` (de, en, es, fr, it), `test` |
| Core API | `createConsentManager`, category defaults/resolution, cookie parse/serialize, consent id, event emitter, region resolution (`regionFromHeaders`, `resolveRegion`, `readGpc`), `readServerConsent`, iframe blocker, network blocker, language controller, lazy integration loader |
| React components | `CookieBanner`, `CookiePreferences`, `CookieOptOut` (CCPA, GPC aware), `GatedScript`, `GatedFrame`, `RecallButton`, `ReloadNotice`, headless parts (`Banner`, `Preferences`, `OptOut`) with data-part/data-state attributes |
| React hooks | `useConsent`, `useConsentActions`, `useConsentCategory`, `useCategories`, `useOnConsentChange`, `useRegion`, `useRegulation`, `useLanguage`, `useTranslations`, `useBannerVisibility`, `usePreferencesOpen`, `useOptOutOpen`, `useThemeVars`, focus trap / escape / autofocus helpers |
| Next.js | App and Pages Router, server-read consent cookie so no banner flash, critical CSS, styles route for strict CSP, Google Consent Mode v2 component |
| Script presets | GA4, GTM, Google Ads, Meta Pixel, Clarity, PostHog, Segment, custom script, pre-consent queue stubs |
| Other | CSS variables, Tailwind, strict CSP, region aware GDPR/CCPA, devtools panel, `npx @cookieyes/cli init`, AI skills (install banner, gate scripts, test consent), llms.txt, context7, size budgets enforced in CI |
| Size | core about 7.7 KB initial / 9.4 KB total gzip; banner about 11.8 KB; banner + prefs + recall about 14.4 KB initial / 17.1 KB total |
| Gaps | No backend, no consent log, no scanner, no dashboard copy, no IAB TCF/GPP, no multi-site, no monetisation |

## 2. Goals and budgets

- Match or beat their DX: one command install, typed headless hooks, unstyled and styled components, no flash on SSR.
- Visual design matches the CookieChimp app (shared design tokens shipped as CSS variables and a Tailwind preset).
- Size budgets (gzip -9, enforced in CI, measured over an empty Next.js app):
  - `core` initial <= 7 KB, total <= 9 KB
  - banner only <= 11 KB
  - banner + preferences + recall <= 13.5 KB initial, <= 16 KB total
  - connected mode sync client lazy loaded, <= 2.5 KB extra (raised from 2 KB in M5 PR21, see docs/size.md)
  - network blocker opt-in, <= 2.25 KB extra
  - TCF/GPP module opt-in, lazy, <= 12 KB, never in the default bundle
- Perf: zero CLS, banner interactive in < 50 ms after hydration, no blocking network request on the critical path (connected config is cached and revalidated).

## 3. Packages and public API

npm scope `@cookiechimp`. pnpm + turbo monorepo, TypeScript, rollup/tsdown ESM + CJS, vitest, Playwright.

- `@cookiechimp/core`: `createConsent(config)` returns runtime with `get()`, `set(partial)`, `acceptAll()`, `rejectAll()`, `subscribe(fn)`, `has(category)`, `region`, `regulation`, `language`; `readConsentCookie(header)`; `resolveRegion(headers)`; `readGpc()`; subpaths `./gate` (declarative script and iframe gating), `./dynamic` (runtime script/iframe blocking), `./network` (fetch/XHR/beacon blocker), `./consent-mode` (Google Consent Mode v2 signals), `./sync`, `./consent-log` (platform consent records), `./endpoint` (self-hosted consent records), `./tcf`, plus `./regions` and `./match`.
- `@cookiechimp/react`: `ConsentProvider`; components `CookieBanner`, `CookiePreferences`, `CookieOptOut`, `GatedScript`, `GatedFrame`, `RecallButton`; headless primitives with `data-cc-part` / `data-cc-state`; hooks `useConsent`, `useConsentActions`, `useCategory`, `useCategories`, `useOnConsentChange`, `useRegion`, `useTranslations`, `useBanner`, `usePreferences`.
- `@cookiechimp/nextjs`: `CookieChimpProvider` (server component reads cookie and region), `getServerConsent()` for App Router, `withConsent` for Pages Router, `GoogleConsentMode`, `stylesRoute` for strict CSP, middleware helper for region headers.
- `@cookiechimp/scripts`: presets `ga4`, `gtm`, `googleAds`, `metaPixel`, `clarity`, `posthog`, `segment`, `hotjar`, `linkedin`, `tiktok`, `customScript`; each maps categories and Consent Mode v2 signals.
- `@cookiechimp/devtools`: floating panel showing state, region, blocked scripts/requests, sync queue, config source (local vs dashboard), simulate region/GPC.
- `@cookiechimp/cli`: `npx @cookiechimp/cli init` (detect framework, install, scaffold provider), `link` (log in, pick site, write projectId to env), `pull` (fetch dashboard config to a local JSON for offline builds), `doctor`.
- `@cookiechimp/translations`: 30+ languages, tree-shakeable per locale.
- Docs extras: llms.txt, llms-full.txt, AI skills (install, gate scripts, test consent, connect to CookieChimp), context7 manifest.

## 4. Local vs connected mode

- Local (default, no account): config in code; consent stored in first-party cookie `cc_consent` (versioned, compact). Optional `onConsent` callback, or a self-hosted record POST through the opt-in `@cookiechimp/core/endpoint` subpath (item 22):
  - `logConsent(runtime, createEndpointLog({ endpoint }))`. `endpoint` is an https URL or a same-origin path such as `/api/consent` (sent with the page's own protocol); an absolute http URL is accepted for localhost in development only. Protocol-relative, `javascript:`, `data:`, credentialed and `#hash` endpoints are refused: they throw in development and make the log a no-op in production (a missing `process` counts as production).
  - Body: `{"schemaVersion": 1, "records": [...]}`. Each record sends exactly `id` (`consentId:ts`, stable across retries; deduplicate on it), `consentId`, `ts`, `action`, `categories`, `services` (when present), `regulation` (when resolved), `gpc`, `language` (when known) and `url` (page origin only). Never sent: IP, user agent field, device id, user id, cookies or the page path.
  - Response: any 2xx means the batch was stored, unless the body is `{"accepted": ["id", ...]}`, in which case only those ids leave the queue. Anything else backs off and retries. The response is untrusted and read up to 64 KB.
  - Same queue, retry, page-hide and fail-closed behaviour as consent records in connected mode (section 5). The receiver must accept `application/json` and, for the page-hide flush, `text/plain` bodies.
- Connected: `projectId` (the platform account hashid) plus an optional publishable key. Adds consent log, scanner categories, dashboard copy, translations, regional rules, styling, TCF/GPP, multi-site. Code config acts as fallback and override (explicit precedence: code `override` > dashboard > code defaults).
- Tier gating is enforced server-side only. Hobby free up to 150 visitors/month, Small Business $10, Pro $40, Enterprise. Over quota: banner keeps working from cached config, logging degrades to sampled, devtools and dashboard show upgrade prompt. The SDK never breaks a site because of billing.

## 5. Sync protocol (connected mode)

Connected mode uses the same per-account config endpoint as the CookieChimp web banner and the mobile SDKs, so one format serves all three. The platform is the Rails app in IdentitySquare/CookieChimp (`Api::V1::MobileSdkController`, `MobileSdk::OfflineBundleBuilder`, documented in its `docs/mobile_sdk.md` and `docs/schemas/sdk-config.v1.json`).

- Identity: `projectId` is the platform account hashid, a public identifier by design. No key is required. An optional publishable key `cc_pk_...` is sent as `Authorization: Bearer` when given. Secret keys `cc_sk_...` are for server and CLI only, and the browser SDK refuses them.
- Config: `GET {origin}/api/v1/mobile-sdk/offline/{account_hashid}`, default origin `https://cookiechimp.com`. It is the offline bundle: `{ schema_version?, version, account_hashid, cache_version, generated_at, country_banner_map{}, default_banner, banners{}, translations{banner: {lang: {consent_modal, preferences_modal, privacy_policy_url}}}, categories[{slug, name, description, required, translations{}, services[{id, name, accepted_by_default, translations{}, storage_items[]}], storage_items[]}], services_index{}, default_services{}, integrations{google_consent_mode, global_privacy_control}, rtl_languages[], cookie_settings{name, expires_days}, updated_at, reconsent_required_at }`.
  - Responses: `404 {error}` for an unknown account or when no banners are configured.
  - Headers: `ETag: "<cache_version>"`, `If-None-Match` gives `304`, and `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. CORS is `*` without credentials and exposes ETag.
  - Website accounts are served once the platform change in IdentitySquare/CookieChimp#2772 ships (before that, the endpoint returns 403 for website accounts).
- SDK adapter (`adaptPlatformConfig` in `./sync`):
  - The banner is chosen by region: `country_banner_map[region]`, then the country part, then `default_banner`. The language is the base of the locale if that banner has it, otherwise the first available language.
  - Categories: `slug` maps to `id`, the translated name and description to `label` and `description`, `required` stays `required`, and `default` is `required || consent_mode === "opt_out"`. Regulation rules still apply on top of that.
  - Services: the slug of the (unique) service name becomes `id`, the category `slug` becomes `category`, `accepted_by_default` becomes `default`, and cookie `storage_items` names become `cookies`. `serviceIds` maps SDK ids back to platform service hashids for consent records.
  - The selected banner's copy, translations, theme and settings, plus `integrations`, `cookie_settings` and `reconsent_required_at`, are exposed on the dashboard state.
- Validation (untrusted input):
  - JSON is parsed with `__proto__`, `constructor` and `prototype` keys dropped at every depth, and the body is capped at 512 KB.
  - `schema_version`, when present, must be 1. `account_hashid` must equal `projectId`, and `cache_version` must be a string.
  - Lookups use own properties only, only known well-typed fields are kept with length caps, and unknown fields are ignored.
- Origin: https only, with no credentials, query or hash. `http://localhost` is allowed in development only (isDev, so a missing `process` counts as production).
- SDK caching: the sanitised bundle is kept in localStorage under `cc_config:{projectId}:{cache_version}`, with a pointer at `cc_config:{projectId}` and only the current version kept. The SDK renders from the cache immediately, revalidates in idle time with `If-None-Match`, and times out after 5 s. A 304 keeps the cache; a hostile or failed response keeps the cache or the code config.
- Precedence: code `override` > dashboard > code defaults. If the categories hash or `reconsent_required_at` changes, `categoriesChanged` is set so the user can be re-prompted (configurable).
- Next.js server fetch uses `revalidate: 300` against the same endpoint so SSR markup already has the dashboard copy.
- Consent records (item 21) live in the opt-in `@cookiechimp/core/consent-log` subpath (`createConsentLog`, `logConsent`) and target the platform consent ingest `POST /api/v1/mobile-sdk/sync/{account_hashid}` in its batch format `{"consents": [...]}`. Each record sends exactly:
  - `client_id`: `{consentId}:{ts}`, unique per decision, used to confirm delivery.
  - `uuid`: the random consent id from the `cc_consent` cookie.
  - `platform`: `"web"`; `visitor_action`: `"consent"`.
  - `url`: the page origin only (no path, query or hash).
  - `gpc_preference`: the GPC signal at decision time.
  - `language_code` (when known), `consent_banner_hashid` (when configured), `created_at` (the decision `ts`).
  - `user_preferences`: `acceptType` (`all`, `necessary` or `custom`), `action`, `acceptedCategories`, `rejectedCategories`, `acceptedServices` and `rejectedServices` (category slug to SDK service ids, unknown services under `other`), and `regulation` when resolved.
  - Never sent: `device_identifier`, `visitor_user_id`, cookies, IP (the platform masks it from the connection), user agent fields or the page path.
- Delivery: `fetch` with `keepalive`, `credentials: "omit"`, `redirect: "error"` and a 10 s timeout. On `visibilitychange` to hidden the whole queue goes out at once as a `text/plain` `fetch` with `keepalive` and `credentials: "omit"` (CORS-safelisted, so no preflight). `sendBeacon` is not used because it always sends cookies. Records leave the queue only when the response confirms them; a page that unloads first resends them on the next visit, which is safe because the platform ingest is idempotent per account on `client_id` (IdentitySquare/CookieChimp#2772). The response is untrusted: only `client_id`s listed in `synced`, or in `failed` with a validation error, leave the queue; `Batch limit exceeded` retries; a 2xx without a readable result counts as delivered; anything else backs off. Recording is synchronous, never throws and never delays the local cookie.
- Guards: an invalid `projectId` or a non-https `apiBase` (localhost allowed in development) throws in development and turns the log into a no-op in production (a missing `process` counts as production).
- Offline queue: localStorage only (`cc_consent_queue:{projectId}`, or `cc_consent_queue:@{endpoint}` for a self-hosted endpoint), max 50 records with the oldest dropped first, exponential backoff with jitter (2 s doubling to 5 min), flush on `online` / `visibilitychange`, drop after 30 days. IndexedDB is not used: records are small and synchronous storage keeps recording synchronous.
- Versioning: `schema_version` major; the SDK ignores unknown fields.
- Server-to-server: `GET /consents/{consentId}` with secret key for DSAR and proof of consent.
- Errors never block rendering; all sync is fire-and-forget with devtools visibility.

## 6. CookieChimp backend additions

1. SDK config endpoint: the shared offline bundle endpoint (section 5) serving website and mobile accounts, with ETag/304 and `max-age=300, stale-while-revalidate=86400` (IdentitySquare/CookieChimp#2772). Per-origin key validation is deferred: the account hashid is public by design.
2. Publishable/secret key management in dashboard, per site.
3. Consent ingest endpoint (queue-backed), idempotency, quota metering by unique consentId per month.
4. Config schema versioning and a JSON schema published for the SDK (`schema_version` and `docs/schemas/sdk-config.v1.json`, IdentitySquare/CookieChimp#2772).
5. Map scanner results to SDK `services` (script URL patterns, cookie names, category) for network and script blocking.
6. Dashboard "SDK" tab: install snippet, mode, last seen SDK version, live consent stream.
7. CMP ID registration with IAB for TCF; GVL proxy/cache endpoint.
8. Usage and billing hooks for tier limits and upgrade prompts.

## 7. TCF / GPP plan

- Phase 1: GPP with US state sections (usnat, usca, etc.) and GPC mapping, `__gpp` stub inlined (< 1 KB), lazy encoder.
- Phase 2: TCF v2.2 in `@cookiechimp/core/tcf`: `__tcfapi` stub, TC string encode, vendor list UI in `CookiePreferences` (virtualised), GVL from CookieChimp CDN. Requires CookieChimp CMP ID and IAB validation; connected mode and Pro tier only.
- Test against IAB CMP validator and GPP test suite in CI.

## 8. Benchmark plan

- Reproduce cookiebannerbench.com methodology: identical empty Next.js app per CMP, measure gzip JS, LCP, CLS, INP, TBT, banner time to visible, via Playwright + Lighthouse on throttled profile, 10 runs median.
- Publish `bench/` in repo with CookieChimp, CookieYes SDK, and other listed CMPs; CI comment on PRs.
- Submit CookieChimp to cookiebannerbench.com once we beat CookieYes on size and CLS.

## 9. Milestones (Codex-sized PRs)

M0 Foundations
1. Monorepo scaffold (pnpm, turbo, biome, tsconfig, vitest, changesets, CI).
2. Size harness and budgets check in CI.
3. Design tokens package from CookieChimp app (CSS vars + Tailwind preset).

M1 Core (local mode)
4. Consent state, cookie codec, emitter, `createConsent`.
5. Categories and services model, config normalisation.
6. Region resolution, GPC, regulation rules (GDPR, CCPA, none).
7. Script gating and iframe blocker.
8. Network blocker (fetch, XHR, beacon).
9. Google Consent Mode v2 signals.

Backlog (after M1): image pixel handler in `./dynamic` (block `img` and `Image()` tracking pixels whose URL matches a service without consent).

M2 React
10. Provider and hooks.
11. Headless Banner, Preferences, OptOut primitives with a11y (focus trap, ESC, ARIA).
12. Styled components matching CookieChimp design, RecallButton, GatedScript, GatedFrame.
13. Translations package and language controller.

M3 Next.js
14. App Router server provider, no-flash SSR, critical CSS.
15. Pages Router support, middleware region helper, strict CSP styles route.

M4 Scripts and tooling
16. Presets: GA4, GTM, Google Ads.
17. Presets: Meta, Clarity, PostHog, Segment, Hotjar, LinkedIn, TikTok.
18. Devtools panel.
19. CLI `init` and `doctor`.

M5 Connected mode
20. `./sync` config fetch, cache, revalidate, precedence merge.
21. Consent POST, offline queue, retry.
22. Self-hosted endpoint option for local mode.
23. CLI `link` and `pull`.
24. Next.js server-side config fetch.

M6 Compliance extensions
25. GPP stub and US sections.
26. TCF v2.2 core and stub.
27. TCF vendor UI.

M7 Launch
28. Docs site, llms.txt, AI skills, examples.
29. Benchmark suite and published results.
30. 1.0 release, npm publish, provenance.
