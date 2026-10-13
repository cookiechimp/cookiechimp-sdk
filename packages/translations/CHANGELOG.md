# @cookiechimp/translations

## 1.0.0

### Major Changes

- Prepare the first coordinated 1.0 release of the CookieChimp Consent SDK. Publication remains gated on review, external prerequisites and explicit approval.

### Minor Changes

- 19a64bc: Add tree-shakeable locale modules, language negotiation and controller APIs, and translated React provider hooks.
  
  `@cookiechimp/react` now uses the keyed `Messages` API. This removes the old
  `Translations` type and changes `t(key, fallback)` to `t(key: MessageKey)`, a
  breaking pre-1.0 API correction. Styled entry points provide English defaults,
  while the provider and hooks entry remains message-free.
- bfe7716: Add opt-in TCF vendor UI labels for every core locale at `@cookiechimp/translations/tcf/<locale>`, plus `tcfMessageKeys`, `TcfMessages` and `tcfReviewedLocales` from `@cookiechimp/translations/tcf`. Existing per-locale bundles are unchanged.
