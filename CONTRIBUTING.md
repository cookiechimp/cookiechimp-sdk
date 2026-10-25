# Contributing

Build this SDK under a clean-room rule. CookieYes is a behavior reference only. Never copy, paste, or closely paraphrase its code.

The SDK never looks up a visitor's location: no geo-IP requests and no external
location services. The one exception, approved by Daniel on 25 October 2026, is
the React Native SDK's opt-in `geolocation` option, which calls CookieChimp's own
first-party `/api/v1/mobile-sdk/geolocation` endpoint only when an app enables it.
Apps have no server headers to supply a region. It stays off by default, and an
unknown region always uses the GDPR fallback.

Do not use em dash characters in code, comments, documentation, commit messages, or other project prose.

Every pull request must pass these required checks: `lint`, `typecheck`, `unit`, `component`, `e2e`, `size`, and the aggregate `ci-required` check.
