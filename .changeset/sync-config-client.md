---
"@cookiechimp/core": minor
---

Add `createSync`, `adaptPlatformConfig` and `safeJson` to `@cookiechimp/core/sync`. Connected mode reads the shared CookieChimp platform offline bundle (the same per-account endpoint as the web banner and mobile SDKs), with a localStorage cache, idle revalidation with ETag, untrusted payload validation, timeout and offline fallback, and code override over dashboard over code defaults precedence.
