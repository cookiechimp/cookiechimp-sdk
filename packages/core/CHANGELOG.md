# @cookiechimp/core

## 1.0.0

### Major Changes

- Prepare the first coordinated 1.0 release of the CookieChimp Consent SDK. Publication remains gated on review, external prerequisites and explicit approval.

### Minor Changes

- 64542f7: `BlockedInfo.category` is now optional. Requests and elements blocked because matching failed (fail closed) are reported without a category or service.
- 19a64bc: Add tree-shakeable locale modules, language negotiation and controller APIs, and translated React provider hooks.

  `@cookiechimp/react` now uses the keyed `Messages` API. This removes the old
  `Translations` type and changes `t(key, fallback)` to `t(key: MessageKey)`, a
  breaking pre-1.0 API correction. Styled entry points provide English defaults,
  while the provider and hooks entry remains message-free.
- a4dc9e3: Add `@cookiechimp/core/consent-log`, an opt-in subpath that POSTs consent records to the CookieChimp platform batch ingest (`/api/v1/mobile-sdk/sync/{account_hashid}`). `logConsent(runtime, createConsentLog({ projectId, apiBase }))` records every decision with minimal fields (no device id, user id, cookies or page path), keeps a persisted queue of up to 50 records for 30 days, retries with capped exponential backoff, flushes on `online`, and flushes the queue as a cookie-less `text/plain` keepalive `fetch` when the page is hidden. A failed POST never blocks or removes the local consent. Invalid options throw in development and make the log a no-op in production.
- 235cf6d: Add IAB GPP v1.1 support for US privacy laws: the opt-in `@cookiechimp/core/gpp-stub` inline `__gpp` stub (under 1 KB gzip) and the lazy `@cookiechimp/core/gpp` module with usnat, usca, usva, usco, usut and usct encoders, GPC mapping, fail-closed consent mapping and the full CMP API.
- 7f3d011: Add an `endpoint` prop to the React and Next.js providers (self-hosted consent records, loaded on demand) and an optional static `headers` option to `createEndpointLog`, still without cookies or credentials.
- 4a5a53f: Add `@cookiechimp/core/endpoint` for local mode: `logConsent(runtime, createEndpointLog({ endpoint: "/api/consent" }))` POSTs consent records to your own endpoint as `{"schemaVersion": 1, "records": [...]}` with minimal fields and a stable `id` to deduplicate on. It shares the consent log queue: persisted, capped at 50 records for 30 days, retried with capped exponential backoff, flushed on `online` and on page hide. Requests never carry cookies or follow redirects, a failed POST never blocks or removes the local consent, and an unsafe endpoint throws in development and turns the log off in production.

  The page-hide flush of both `./consent-log` and `./endpoint` now uses a `text/plain` keepalive `fetch` with `credentials: "omit"` instead of `navigator.sendBeacon`, which always sends cookies.
- 6369535: Add `createSync`, `adaptPlatformConfig` and `safeJson` to `@cookiechimp/core/sync`. Connected mode reads the shared CookieChimp platform offline bundle (the same per-account endpoint as the web banner and mobile SDKs), with a localStorage cache, idle revalidation with ETag, untrusted payload validation, timeout and offline fallback, and code override over dashboard over code defaults precedence.
- 76dc7f4: Add IAB TCF support: the opt-in `@cookiechimp/core/tcf-stub` inline `__tcfapi` stub and the lazy `@cookiechimp/core/tcf` module with a TCF v2.3 TC string encoder (mandatory disclosed vendors segment), GVL validation, the CMP API and fail-closed `cmpId` handling (required in production).
- f5831fa: `TcfVendorList` shows a Details panel per vendor with purposes, retention, privacy policy and legitimate interest claim links and device storage disclosures, as TCF policy requires. `parseGvl` keeps those GVL fields (links must be https). A focused vendor row now stays mounted while scrolled out of view, so keyboard focus is no longer lost.
- 990d709: Add the TCF vendor list UI: `TcfVendorList` in `@cookiechimp/react/tcf` (windowed, searchable, with per-purpose, per-vendor and right to object choices) and a `children` slot on `CookiePreferences`. `@cookiechimp/core/tcf` gains `setChoices`, `subscribe`, ID-only choice persistence and GVL names.

### Patch Changes

- 768f6f8: Next.js connected mode now applies the dashboard cookie name and expiry on the server and revalidates the config in the browser after hydration. `createSync` gains an `etag` seed option and no longer lets a busy page postpone revalidation indefinitely (idle callback timeout).
- a1ef889: Keep React-owned gated script nodes stable through activation and reconciliation. Prevent duplicate execution across gate controllers and recheck consent before queued scripts execute. Generate CLI configurations that pass TypeScript.

  Decode filesystem URLs when generating Next.js critical CSS so builds work in paths with spaces.
