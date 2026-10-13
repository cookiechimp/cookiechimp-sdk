---
"@cookiechimp/core": minor
---

Add IAB TCF support: the opt-in `@cookiechimp/core/tcf-stub` inline `__tcfapi` stub and the lazy `@cookiechimp/core/tcf` module with a TCF v2.3 TC string encoder (mandatory disclosed vendors segment), GVL validation, the CMP API and fail-closed `cmpId` handling (required in production).
