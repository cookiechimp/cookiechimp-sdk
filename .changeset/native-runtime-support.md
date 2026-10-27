---
"@cookiechimp/core": minor
---

Run the consent runtime and consent log outside a browser, for the upcoming React Native SDK. `createConsent` accepts a synchronous `storage` adapter that replaces `document.cookie` and honors `cookie.maxAge`. `createConsentLog` accepts `platform: "ios" | "android"`, and every consent log gains `retry()` to clear backoff and send now. The runtime no longer requires Web Crypto, `TextDecoder` or DOM events, so it works on Hermes without polyfills.
