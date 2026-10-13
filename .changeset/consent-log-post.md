---
"@cookiechimp/core": minor
---

Add `@cookiechimp/core/consent-log`, an opt-in subpath that POSTs consent records to the CookieChimp platform batch ingest (`/api/v1/mobile-sdk/sync/{account_hashid}`). `logConsent(runtime, createConsentLog({ projectId, apiBase }))` records every decision with minimal fields (no device id, user id, cookies or page path), keeps a persisted queue of up to 50 records for 30 days, retries with capped exponential backoff, flushes on `online`, and flushes the queue as a cookie-less `text/plain` keepalive `fetch` when the page is hidden. A failed POST never blocks or removes the local consent. Invalid options throw in development and make the log a no-op in production.
