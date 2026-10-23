# @cookiechimp/devtools

## 1.1.0

### Patch Changes

- Updated dependencies [ee94b48]
  - @cookiechimp/core@1.1.0

## 1.0.0

### Major Changes

- Prepare the first coordinated 1.0 release of the CookieChimp Consent SDK. Publication remains gated on review, external prerequisites and explicit approval.

### Minor Changes

- 090a3ff: Add `@cookiechimp/devtools`: a floating development panel that shows consent state, region, regulation, GPC, blocked scripts and requests, the sync queue and the config source, and simulates a region and GPC through the `@cookiechimp/devtools/simulation` subpath.

  `readSimulation()` returns `null` without reading storage in production builds unless it is called with `{ allowProduction: true }`, so a visitor cannot change the region or GPC signal through sessionStorage. Script-tag and CDN builds where `process` is not defined are treated as production, both by `readSimulation()` and by the panel mount guard.

### Patch Changes

- Updated dependencies [64542f7]
- Updated dependencies [19a64bc]
- Updated dependencies [768f6f8]
- Updated dependencies [a4dc9e3]
- Updated dependencies [235cf6d]
- Updated dependencies
- Updated dependencies [7f3d011]
- Updated dependencies [a1ef889]
- Updated dependencies [4a5a53f]
- Updated dependencies [6369535]
- Updated dependencies [76dc7f4]
- Updated dependencies [f5831fa]
- Updated dependencies [990d709]
  - @cookiechimp/core@1.0.0
