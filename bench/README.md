# Reproducible consent benchmarks

This suite compares a no-CMP baseline, CookieChimp, CookieYes SDK 0.8.1
(`@cookieyes/nextjs`) and Vanilla CookieConsent 3.1.0 on the same minimal
Next.js 16.4.3 / React 19.3.0 page. Archived result files retain the framework
versions and source revision under which they were measured. Each fixture has its own production build,
so one product's styles or code cannot enter another product's baseline.
`fixtures/shared/page.tsx` and `styles.css` supply identical page content.
No vendor implementation is copied; comparator adapters use public APIs only.

## Run

```sh
pnpm install --frozen-lockfile
pnpm bench:build
pnpm bench:run
```

The default is 10 measured runs per fixture, plus one excluded warmup.
Fixtures run serially in a reproducible shuffled order (seed 42). Each fresh
load gets an isolated browser context and empty consent storage. Servers bind
to free localhost ports and are stopped on completion or interruption.
Do not run builds or other CPU-heavy work during a measured run.

Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to choose Chrome. Otherwise
chrome-launcher discovers the local installation. Browser version and host
CPU, OS, lockfile hash, source commit and dirty state are retained in the JSON.
The source must be committed and the checkout clean before recording publishable
results. An output file is created exclusively, so reruns cannot overwrite evidence.

```sh
pnpm bench:run --runs=1 --warmups=0 --no-lighthouse --output=/tmp/consent-smoke.json
```

Smoke runs check the adapters and collector; they do not support a ranking.
The CI PR check uses two runs without Lighthouse. A separate workflow summarizes
its status on the PR without running untrusted PR code with a write token.
The manual Benchmark workflow can run the full 10-sample Lighthouse protocol.

## Measurement

- Mobile viewport: 390 x 844, DPR 1; CDP CPU slowdown 4x, network latency
  150 ms, download 1600 Kibit/s and upload 750 Kibit/s. These are declared lab
  settings, not a calibrated physical phone.
- Fresh-load native observations end 3000 ms after navigation start. Every
  expected banner must be visible and the common page must hydrate. The JSON
  retains native LCP candidates and layout-shift observations. CLS uses the
  largest session window (one-second gap, five-second maximum, recent input
  excluded). This is a bounded lab observation, not full-visit field CLS.
- Banner visibility is an observed layout box and computed style. It does
  not prove painted pixels or working event handlers. A subsequent real
  accept action must close the banner and persist a cookie; the shared page
  button must remain responsive.
- Native Event Timing supplies the longest observed consent/page interaction
  duration. This is a lab proxy, not field INP. Browsers may not expose a short
  interaction; missing values stay unavailable.
- JavaScript, HTML and CSS response bodies requested during the observation
  window are recompressed separately with gzip level 9 and summed. These
  are reproducible body-size estimates, not encoded transfer bytes. HTML
  includes server-rendered state and inline bootstrap scripts. Network-cache
  reads are disabled. External fixture requests fail the sample.
- Lighthouse runs a separate fresh navigation with the same declared
  viewport and throttling, and records LCP, CLS and Total Blocking Time.
  The JSON keeps the original metric audits and effective settings.
- Returning visitors are prepared by accepting in the actual UI. Reload
  must retain consent and show no banner, including during hydration.
- Failed attempts remain in raw JSON with a reason. Missing, failed or
  incomplete fixtures receive no aggregate medians. Missing measurements
  never become zero. Comparisons use 10-run medians; baseline differences
  are descriptive and do not establish statistical superiority.

CookieChimp and CookieYes use their documented server-cookie integrations.
CookieChimp and Vanilla have necessary, analytics and marketing categories;
CookieYes uses its default taxonomy. Default product styles and transitions
are retained, including CookieYes attribution. Different UI content is a
comparison limitation. Remote CMP products requiring account configuration
are not represented by invented scores.

## Sources and scope

The plan was inspired by [CookieBench](https://cookiebench.com/methodology)
and its [public methodology](https://github.com/inthhq/cookiebench). This is
an independent empty-page suite, not a reproduction of its current article
workload, capability matrix or statistical methodology. See the exact
methodology identifier in each raw result.

Lighthouse measurements use [Google's official runner](https://github.com/GoogleChrome/lighthouse).
Comparator adapters follow the published API documentation for
[CookieYes](https://developers.cookieyes.com/docs/nextjs/getting-started/configuration)
and [Vanilla CookieConsent](https://cookieconsent.orestbida.com/reference/configuration-reference.html).
No external benchmark submission has been made.
