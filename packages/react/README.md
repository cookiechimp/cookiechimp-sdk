# @cookiechimp/react

Documentation: [CookieChimp Consent SDK](https://docs.cookiechimp.com/docs/sdk/overview).

Accessible React consent UI and headless hooks for CookieChimp.

This package is being prepared for CookieChimp SDK 1.0. npm installation is
available after publication. See the [SDK reference](https://github.com/cookiechimp/cookiechimp-sdk#readme)
and [release status](https://github.com/cookiechimp/cookiechimp-sdk/blob/main/docs/remaining-work.md).

MIT licensed. CookieChimp makes no client-side geolocation requests.

## Platform JSON UI

`@cookiechimp/react/platform` exports `PlatformConsentProvider`, `CookieBanner`,
`CookiePreferences` and `RecallButton`. Import `@cookiechimp/react/platform.css`
for the styled banner and category/vendor modal. Pass the unchanged platform
offline JSON as `bundle`, with trusted `region` and optional `locale`. Use
`motion={false}` to disable default animations; reduced motion is automatic.
The modal shows the consent ID, a divided fixed header and actions, and a
scrolling content body. `consentIdLabel` translates the ID label.

The regular hooks work inside this provider. Runtime consent state includes
every configured service and its effective boolean before and after a choice;
no configured services produces `{}`. See [the complete guide](https://docs.cookiechimp.com/docs/sdk/platform-ui)
for the JSON fields, appearance, logging and runnable playground.
