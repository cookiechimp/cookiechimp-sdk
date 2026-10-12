---
"@cookiechimp/translations": minor
"@cookiechimp/core": minor
"@cookiechimp/react": minor
---

Add tree-shakeable locale modules, language negotiation and controller APIs, and translated React provider hooks.

`@cookiechimp/react` now uses the keyed `Messages` API. This removes the old
`Translations` type and changes `t(key, fallback)` to `t(key: MessageKey)`, a
breaking pre-1.0 API correction. Styled entry points provide English defaults,
while the provider and hooks entry remains message-free.
