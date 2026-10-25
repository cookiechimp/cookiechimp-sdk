# @cookiechimp/core

Documentation: [CookieChimp Consent SDK](https://docs.cookiechimp.com/docs/sdk/overview).

Consent state, cookie storage and opt-in script, network and IAB integrations.

This package is being prepared for CookieChimp SDK 1.0. npm installation is
available after publication. See the [SDK reference](https://github.com/cookiechimp/cookiechimp-sdk#readme)
and [release status](https://github.com/cookiechimp/cookiechimp-sdk/blob/main/docs/remaining-work.md).

## Runtimes without a browser

The consent runtime and consent log also run where there is no `document`, such
as React Native. Pass a synchronous `storage` adapter (`getItem` and `setItem`)
to `createConsent` to persist consent there instead of in a cookie. The encoded
value is stored under `cookie.name` and is ignored once `cookie.maxAge` has
passed since the decision. Pass `platform: "ios"` or `"android"` to
`createConsentLog`, and call `log.retry()` when the app returns to the
foreground or regains connectivity, because there are no `online` or
`visibilitychange` events. Web Crypto and `TextDecoder` are used when available
and are not required.

MIT licensed. CookieChimp makes no client-side geolocation requests.
