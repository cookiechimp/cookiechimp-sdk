---
"@cookiechimp/core": minor
---

Add `@cookiechimp/core/endpoint` for local mode: `logConsent(runtime, createEndpointLog({ endpoint: "/api/consent" }))` POSTs consent records to your own endpoint as `{"schemaVersion": 1, "records": [...]}` with minimal fields and a stable `id` to deduplicate on. It shares the consent log queue: persisted, capped at 50 records for 30 days, retried with capped exponential backoff, flushed on `online` and on page hide. Requests never carry cookies or follow redirects, a failed POST never blocks or removes the local consent, and an unsafe endpoint throws in development and turns the log off in production.

The page-hide flush of both `./consent-log` and `./endpoint` now uses a `text/plain` keepalive `fetch` with `credentials: "omit"` instead of `navigator.sendBeacon`, which always sends cookies.
