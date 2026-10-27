# CookieChimp Consent SDK

Open-source, lightweight consent SDK for React, Next.js and plain JavaScript,
built by CookieChimp. MIT licensed.

- **Connected mode.** Load a CookieChimp project's scanner categories,
  dashboard copy and translations with config sync, and send decisions with
  the platform consent-log adapter. Your code config can remain the fallback.
- **Category and vendor preferences.** Render banner layouts, vendor details,
  cookie disclosures, themes and languages from the platform JSON. A complete
  service consent map and consent ID are available through React hooks.
- **Local mode, no account.** Consent lives in a first-party `cc_consent`
  cookie. Your code owns the config.
- **No banner flash.** The Next.js providers read the consent cookie on the
  server, so the first HTML already matches the visitor's choice.
- **Blocks before consent.** Script and iframe gating, runtime blocking, a
  network blocker, Google Consent Mode v2 and presets for common vendors.
- **IAB GPP (US) and TCF (EU)**, both opt-in and lazy.
- **Small.** Size budgets are enforced in CI ([docs/size.md](../../../docs/size.md)).

The SDK never looks up a visitor's location. It makes no geo-IP or external
location request. Applications pass trusted region context, for example from
their hosting platform's headers. React Native apps can opt in to CookieChimp's
own first-party region lookup instead.

## Where to start

- [Connect to CookieChimp](connected-backend.md): dashboard configuration,
  platform consent delivery and the complete backend-connected example.
- [Getting started](getting-started.md): install and show a banner.
- [React Native](../../react-native/README.md): the native banner,
  preferences, consent records and vendor control for React Native and Expo
  apps (in development, not yet published).
- [Banner and vendor preferences](platform-ui.md): shared JSON, appearance,
  consent state and the full variation playground.
- [Next.js](../../nextjs/README.md) or the [core and React reference](../../../README.md).
- [Examples](examples.md) you can run.
- [AI skills](ai-skills.md) for coding agents and the
  [documentation index](https://docs.cookiechimp.com/docs/llms.txt).

Current release: **1.1.0**, available on npm. See [versions and deployment](deployment.md)
for installation, upgrading and connected-mode verification.
