# @cookiechimp/scripts

## 1.1.0

### Patch Changes

- Updated dependencies [ee94b48]
  - @cookiechimp/core@1.1.0

## 1.0.0

### Major Changes

- Prepare the first coordinated 1.0 release of the CookieChimp Consent SDK. Publication remains gated on review, external prerequisites and explicit approval.

### Minor Changes

- 1ae9aa7: Add opt-in GA4, GTM, and Google Ads presets with service matching, gated loader descriptors, queue stubs, and Consent Mode v2 mappings.
- 8fb2cdf: Add opt-in presets for Meta Pixel, Microsoft Clarity, PostHog, Segment, Hotjar, LinkedIn Insight and TikTok Pixel, each on its own subpath.

  Each vendor preset has `sync(consent)`, which follows its category and calls the vendor's consent API on revoke and grant (Meta `fbq('consent')`, Clarity `clarity('consent')`, PostHog `opt_out_capturing` and `opt_in_capturing`, TikTok `revokeConsent` and `grantConsent`). Calls made before the vendor script loads are queued. Segment, Hotjar and LinkedIn have no consent API: `preset.revoke` is `"reload"` for them, and a page reload is needed to stop code that already loaded.

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
