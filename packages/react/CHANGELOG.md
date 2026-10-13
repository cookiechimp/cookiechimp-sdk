# @cookiechimp/react

## 1.0.0

### Major Changes

- Prepare the first coordinated 1.0 release of the CookieChimp Consent SDK. Publication remains gated on review, external prerequisites and explicit approval.

### Minor Changes

- f50f834: Bind the optional TCF controller to the existing consent runtime through a dedicated React provider entry and a Next.js TcfStub helper. Fail closed on invalid CMP/GVL input and clean up replaced controllers and pending loads.

- 19a64bc: Add tree-shakeable locale modules, language negotiation and controller APIs, and translated React provider hooks.

  `@cookiechimp/react` now uses the keyed `Messages` API. This removes the old
  `Translations` type and changes `t(key, fallback)` to `t(key: MessageKey)`, a
  breaking pre-1.0 API correction. Styled entry points provide English defaults,
  while the provider and hooks entry remains message-free.
- 59b9425: Add an opt-in `gpp` prop to `ConsentProvider`, `ClientProvider`, `PagesConsentProvider` and `CookieChimpProvider` that lazily installs IAB GPP US sections after hydration, and a `GppStub` head component in `@cookiechimp/nextjs/server`.
- 7f3d011: Add an `endpoint` prop to the React and Next.js providers (self-hosted consent records, loaded on demand) and an optional static `headers` option to `createEndpointLog`, still without cookies or credentials.
- d512643: Add the `@cookiechimp/react/headless` Banner, Preferences, and OptOut primitives with accessible dialogs, focus management, and consent controls.
- 3f1454f: Add token-based styled consent components, a recall control, and declaratively gated script and frame components.
- f5831fa: `TcfVendorList` shows a Details panel per vendor with purposes, retention, privacy policy and legitimate interest claim links and device storage disclosures, as TCF policy requires. `parseGvl` keeps those GVL fields (links must be https). A focused vendor row now stays mounted while scrolled out of view, so keyboard focus is no longer lost.
- 990d709: Add the TCF vendor list UI: `TcfVendorList` in `@cookiechimp/react/tcf` (windowed, searchable, with per-purpose, per-vendor and right to object choices) and a `children` slot on `CookiePreferences`. `@cookiechimp/core/tcf` gains `setChoices`, `subscribe`, ID-only choice persistence and GVL names.

### Patch Changes

- a1ef889: Keep React-owned gated script nodes stable through activation and reconciliation. Prevent duplicate execution across gate controllers and recheck consent before queued scripts execute. Generate CLI configurations that pass TypeScript.

  Decode filesystem URLs when generating Next.js critical CSS so builds work in paths with spaces.
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
- Updated dependencies [bfe7716]
- Updated dependencies [f5831fa]
- Updated dependencies [990d709]
  - @cookiechimp/core@1.0.0
  - @cookiechimp/translations@1.0.0
  - @cookiechimp/tokens@1.0.0
