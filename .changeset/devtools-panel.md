---
"@cookiechimp/devtools": minor
---

Add `@cookiechimp/devtools`: a floating development panel that shows consent state, region, regulation, GPC, blocked scripts and requests, the sync queue and the config source, and simulates a region and GPC through the `@cookiechimp/devtools/simulation` subpath.

`readSimulation()` returns `null` in production builds unless it is called with `{ allowProduction: true }`, so a visitor cannot change the region or GPC signal through sessionStorage.
