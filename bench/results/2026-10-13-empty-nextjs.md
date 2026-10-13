# CookieChimp SDK benchmark results

Recorded 2026-10-13T18:33:50.834Z. 10 measured runs per fixture. Excluded warmups per fixture: 1. This is a local lab comparison of pinned versions, not field Core Web Vitals or a certification.

| Fixture | Passed | JS gzip bytes | JS overhead vs baseline | Native LCP ms | Native CLS | Banner observed ms | Consent interaction ms | Lighthouse LCP ms | Lighthouse CLS | Lighthouse TBT ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| cookiechimp | 10/10 | 142263 | 7066 | 470.0 | 0.0000 | 456.9 | 24.0 | 477.9 | 0.0000 | 8.5 |
| cookieyes | 10/10 | 150251 | 15054 | 1220.0 | 0.0000 | 480.0 | 24.0 | 1244.2 | 0.0000 | 10.4 |
| vanilla | 10/10 | 144315 | 9118 | 500.0 | 0.0000 | 1311.4 | 24.0 | 511.0 | 0.0000 | 7.9 |
| baseline | 10/10 | 135197 | 0 | 364.0 | 0.0000 | unavailable | 24.0 | 372.9 | 0.0000 | 7.4 |

JavaScript bytes are the sum of gzip -9 response bodies fetched during the fresh-load observation window; HTML and CSS bytes are retained separately in raw samples. CookieChimp's server cookie seed is included in HTML. Subtracted medians are descriptive differences, not statistical evidence of superiority.

The native interaction column is the longest Event Timing duration among the exercised consent and page actions. It is not field INP. Missing browser timing stays unavailable. Banner timing observes layout visibility, not painted pixels or interactivity. Returning visitors are prepared by a real accept action and reloaded to verify the choice persists.

See [methodology](../README.md) and the adjacent raw JSON for browser, host, dependency, throttle and source provenance. Failed attempts are retained. A missing or failed sample withholds medians for that fixture.
