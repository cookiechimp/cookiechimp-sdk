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
  - connected mode sync client lazy loaded, <= 2 KB extra
  - network blocker opt-in, <= 2.25 KB extra
  - TCF/GPP module opt-in, lazy, <= 12 KB, never in the default bundle
- Perf: zero CLS, banner interactive in < 50 ms after hydration, no blocking network request on the critical path (connected config is cached and revalidated).

## 3. Packages and public API

npm scope `@cookiechimp`. pnpm + turbo monorepo, TypeScript, rollup/tsdown ESM + CJS, vitest, Playwright.

- `@cookiechimp/core`: `createConsent(config)` returns runtime with `get()`, `set(partial)`, `acceptAll()`, `rejectAll()`, `subscribe(fn)`, `has(category)`, `region`, `regulation`, `language`; `readConsentCookie(header)`; `resolveRegion(headers)`; `readGpc()`; subpaths `./gate` (declarative script and iframe gating), `./dynamic` (runtime script/iframe blocking), `./network` (fetch/XHR/beacon blocker), `./sync`, `./tcf`, plus `./regions` and `./match`.
- `@cookiechimp/react`: `ConsentProvider`; components `CookieBanner`, `CookiePreferences`, `CookieOptOut`, `GatedScript`, `GatedFrame`, `RecallButton`; headless primitives with `data-cc-part` / `data-cc-state`; hooks `useConsent`, `useConsentActions`, `useCategory`, `useCategories`, `useOnConsentChange`, `useRegion`, `useTranslations`, `useBanner`, `usePreferences`.
- `@cookiechimp/nextjs`: `CookieChimpProvider` (server component reads cookie and region), `getServerConsent()` for App Router, `withConsent` for Pages Router, `GoogleConsentMode`, `stylesRoute` for strict CSP, middleware helper for region headers.
- `@cookiechimp/scripts`: presets `ga4`, `gtm`, `googleAds`, `metaPixel`, `clarity`, `posthog`, `segment`, `hotjar`, `linkedin`, `tiktok`, `customScript`; each maps categories and Consent Mode v2 signals.
- `@cookiechimp/devtools`: floating panel showing state, region, blocked scripts/requests, sync queue, config source (local vs dashboard), simulate region/GPC.
- `@cookiechimp/cli`: `npx @cookiechimp/cli init` (detect framework, install, scaffold provider), `link` (log in, pick site, write projectId to env), `pull` (fetch dashboard config to a local JSON for offline builds), `doctor`.
- `@cookiechimp/translations`: 30+ languages, tree-shakeable per locale.
- Docs extras: llms.txt, llms-full.txt, AI skills (install, gate scripts, test consent, connect to CookieChimp), context7 manifest.

## 4. Local vs connected mode

- Local (default, no account): config in code; consent stored in first-party cookie `cc_consent` (versioned, compact). Optional `onConsent` callback or `endpoint` for self-hosted record POST.
- Connected: `projectId` + publishable key. Adds consent log, scanner categories, dashboard copy, translations, regional rules, styling, TCF/GPP, multi-site. Code config acts as fallback and override (explicit precedence: code `override` > dashboard > code defaults).
- Tier gating is enforced server-side only. Hobby free up to 150 visitors/month, Small Business $10, Pro $40, Enterprise. Over quota: banner keeps working from cached config, logging degrades to sampled, devtools and dashboard show upgrade prompt. The SDK never breaks a site because of billing.

## 5. Sync protocol (connected mode)

Base `https://api.cookiechimp.com/sdk/v1`. Publishable key `cc_pk_...` (origin-restricted, safe in browser). Secret key `cc_sk_...` only for server and CLI.

- `GET /projects/{projectId}/config?locale=&region=` returns `{ schemaVersion, configVersion, etag, categories[], services[], copy{}, translations{}, regions{}, theme{}, tcf?{}, gpp?{} }`. Headers: `Authorization: Bearer cc_pk_...`, `If-None-Match`. Served via CDN, `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.
- SDK caching: last good config in localStorage keyed by projectId+configVersion; render from cache immediately, revalidate in idle time. Next.js server fetch uses `revalidate: 300` so SSR markup already has dashboard copy.
- `POST /projects/{projectId}/consents` body `{ consentId, ts, region, regulation, gpc, categories{}, services{}?, tcString?, gppString?, configVersion, sdkVersion, url, action: accept_all|reject_all|custom|gpc_auto }`. Returns `202 { receiptId }`. Idempotent on `consentId+ts`. Sent with `fetch keepalive`, falling back to `sendBeacon`.
- Offline queue: IndexedDB (fallback localStorage), max 50 records, exponential backoff, flush on `online` / `visibilitychange`, drop after 30 days.
- Versioning: `schemaVersion` major in URL path; SDK ignores unknown fields; if `configVersion` changes the categories hash, re-prompt the user (configurable).
- Server-to-server: `GET /consents/{consentId}` with secret key for DSAR and proof of consent.
- Errors never block rendering; all sync is fire-and-forget with devtools visibility.

## 6. CookieChimp backend additions

1. SDK config endpoint with CDN caching, etag, per-origin key validation.
2. Publishable/secret key management in dashboard, per site.
3. Consent ingest endpoint (queue-backed), idempotency, quota metering by unique consentId per month.
4. Config schema versioning and a JSON schema published for the SDK.
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
