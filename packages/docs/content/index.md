# CookieChimp Consent SDK

Open-source, lightweight consent SDK for React, Next.js and plain JavaScript,
built by CookieChimp. MIT licensed.

- **Local mode, no account.** Consent lives in a first-party `cc_consent`
  cookie. Your code owns the config.
- **Connected mode.** Pass a CookieChimp `projectId` to sync the consent log,
  scanner categories, dashboard copy, translations, regional rules and
  styling. Your code config stays as the fallback.
- **No banner flash.** The Next.js providers read the consent cookie on the
  server, so the first HTML already matches the visitor's choice.
- **Blocks before consent.** Script and iframe gating, runtime blocking, a
  network blocker, Google Consent Mode v2 and presets for common vendors.
- **IAB GPP (US) and TCF (EU)**, both opt-in and lazy.
- **Small.** Size budgets are enforced in CI ([docs/size.md](../../../docs/size.md)).

The SDK never looks up a visitor's location. It makes no geo-IP or external
location request. Applications pass trusted region context, for example from
their hosting platform's headers.

## Where to start

- [Getting started](getting-started.md): install and show a banner.
- [Next.js](../../nextjs/README.md) or the [core and React reference](../../../README.md).
- [Examples](examples.md) you can run.
- [AI skills](ai-skills.md) for coding agents, and [llms.txt](https://llmstxt.org)
  at `/llms.txt` and `/llms-full.txt` on this site.

Status: pre-alpha. The API may change before 1.0.
