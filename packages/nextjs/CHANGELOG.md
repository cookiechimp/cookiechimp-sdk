# @cookiechimp/nextjs

## 1.0.0

### Major Changes

- Prepare the first coordinated 1.0 release of the CookieChimp Consent SDK. Publication remains gated on review, external prerequisites and explicit approval.

### Minor Changes

- 768f6f8: Next.js connected mode now applies the dashboard cookie name and expiry on the server and revalidates the config in the browser after hydration. `createSync` gains an `etag` seed option and no longer lets a busy page postpone revalidation indefinitely (idle callback timeout).
- 59b9425: Add an opt-in `gpp` prop to `ConsentProvider`, `ClientProvider`, `PagesConsentProvider` and `CookieChimpProvider` that lazily installs IAB GPP US sections after hydration, and a `GppStub` head component in `@cookiechimp/nextjs/server`.
- 22dfc25: Add App Router server consent, no-flash hydration, generated critical CSS, and Google Consent Mode defaults.
- 4489105: Fetch the dashboard config on the server: `getServerConfig` and a `projectId` prop on `CookieChimpProvider` (Next.js data cache, `revalidate: 300`), so SSR markup already has the dashboard categories and copy. Falls back to the code config on any failure.
- 7f3d011: Add an `endpoint` prop to the React and Next.js providers (self-hosted consent records, loaded on demand) and an optional static `headers` option to `createEndpointLog`, still without cookies or credentials.
- 8381d60: Add Pages Router consent hydration, trusted middleware region forwarding, and a strict CSP stylesheet route.

### Patch Changes

- a1ef889: Keep React-owned gated script nodes stable through activation and reconciliation. Prevent duplicate execution across gate controllers and recheck consent before queued scripts execute. Generate CLI configurations that pass TypeScript.
  
  Decode filesystem URLs when generating Next.js critical CSS so builds work in paths with spaces.
- Updated dependencies [64542f7]
- Updated dependencies [19a64bc]
- Updated dependencies [768f6f8]
- Updated dependencies [a4dc9e3]
- Updated dependencies [59b9425]
- Updated dependencies [235cf6d]
- Updated dependencies
- Updated dependencies [7f3d011]
- Updated dependencies [d512643]
- Updated dependencies [a1ef889]
- Updated dependencies [3f1454f]
- Updated dependencies [4a5a53f]
- Updated dependencies [6369535]
- Updated dependencies [76dc7f4]
- Updated dependencies [f5831fa]
- Updated dependencies [990d709]
  - @cookiechimp/core@1.0.0
  - @cookiechimp/react@1.0.0
  - @cookiechimp/tokens@1.0.0
