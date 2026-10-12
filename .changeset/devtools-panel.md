---
"@cookiechimp/devtools": minor
---

Add `@cookiechimp/devtools`: a floating development panel that shows consent state, region, regulation, GPC, blocked scripts and requests, the sync queue and the config source, and simulates a region and GPC through the `@cookiechimp/devtools/simulation` subpath.

`readSimulation()` returns `null` without reading storage in production builds unless it is called with `{ allowProduction: true }`, so a visitor cannot change the region or GPC signal through sessionStorage. Script-tag and CDN builds where `process` is not defined are treated as production, both by `readSimulation()` and by the panel mount guard.
