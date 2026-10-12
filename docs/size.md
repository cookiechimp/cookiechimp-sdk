# Size budgets

Run `pnpm size` to build the packages and print every budget from `size-budgets.json`. The command exits with a non-zero status if an available entry exceeds its limit or if opt-in TCF/GPP code is found in the default core bundle.

The harness bundles each entry's full import graph with Rolldown, using ESM output and minification, and then uses Node's `zlib.gzip` with `level: 9`. Bare workspace imports are resolved through Node package resolution and package exports. React, React DOM, the React JSX runtimes, and every package-declared peer dependency remain external because peers are provided by the host application. Sizes are bytes, and limits use 1 KB = 1024 bytes.

For `initial`, Rolldown emits separate dynamic chunks and the harness gzips only the entry chunk, so the measurement includes static imports but not dynamically imported code. For `total`, `extra`, and `lazy`, dynamic imports are inlined and the harness gzips the single complete bundle. This measures compression across the bundle instead of adding independently compressed source modules.

The styled React budgets use runnable source scenarios in `scripts/size-scenarios`. The banner scenario renders `ConsentProvider` and `CookieBanner`. The complete UI scenario renders `ConsentProvider`, `CookieBanner`, `CookiePreferences`, and `RecallButton`. This keeps the provider and its `createConsent` core runtime in the tree-shaken graph instead of measuring an isolated leaf entry. Both scenarios also declare `packages/react/styles.css` in their `css` list. The harness recursively resolves its `@import "@cookiechimp/tokens/css"`, gzips the combined CSS at level 9, and adds those bytes to the JavaScript result. The direct banner and UI distribution entries remain visible as informational rows, which print sizes but never fail a budget.

The checked budgets are the source-of-truth values below. Region header providers and built-in regulation tables live only in `@cookiechimp/core/regions`. The `@cookiechimp/core/sync` entry is enforced separately and is excluded from the default entry. Declarative gating lives in `@cookiechimp/core/gate`, and runtime blocking lives in `@cookiechimp/core/dynamic`. Their budgets are CookieChimp guards (SPEC.md sets no number for them), and both stay out of the default entry. The fetch, XHR, and beacon blocker lives in `@cookiechimp/core/network`, has a 2304 B gzip budget, and also stays out of the default entry.

<!-- size-budgets:start -->
| Name | Kind | Limit (bytes) |
|---|---:|---:|
| declarative script and iframe gating | extra | 2048 |
| runtime script and iframe blocking | extra | 2688 |
| network blocking | extra | 2304 |
| consent-mode | extra | 1560 |
| language controller | extra | 1050 |
| core initial | initial | 4096 |
| core total | total | 5120 |
| react provider and hooks | extra | 4608 |
| Next.js client provider bridge | extra | 4370 |
| Next.js server entry | extra | INFO |
| Next.js Pages client wrapper | extra | 6225 |
| Next.js middleware region helper | extra | 1150 |
| Next.js styles route | extra | INFO |
| react headless primitives | extra | 3491 |
| banner only | initial | 11264 |
| banner distribution entry | initial | 11264 |
| banner, preferences, recall initial | initial | 13824 |
| UI distribution entry initial | initial | 13824 |
| banner, preferences, recall total | total | 16384 |
| UI distribution entry total | total | 16384 |
| connected sync client | extra | 2048 |
| GA4 preset | extra | 830 |
| GTM preset | extra | 915 |
| Google Ads preset | extra | 890 |
| Meta Pixel preset | extra | 895 |
| Clarity preset | extra | 880 |
| PostHog preset | extra | 1060 |
| Segment preset | extra | 1055 |
| Hotjar preset | extra | 935 |
| LinkedIn Insight preset | extra | 880 |
| TikTok Pixel preset | extra | 995 |
| TCF/GPP module | lazy | 12288 |
<!-- size-budgets:end -->

Until the M3 Next.js package exists, `fixtures/nextjs-app` is the empty stand-in application. Its page is the baseline and contributes zero package bytes. Source scenario measurement avoids build identifiers and framework chunk allocation changing the result while measuring the complete CookieChimp graph used by a realistic render. Fixture-delta measurement is deferred to M7. The fixture no-flash test remains part of the required end-to-end job.

Entries planned for later milestones remain visible as `PENDING` only when their paths are on the harness's explicit allowlist. A missing path outside that allowlist fails with a non-zero exit, preventing a typo from remaining pending indefinitely. File existence controls the allowlisted state, so the same row becomes enforced automatically when its configured build output appears.

The TCF/GPP exclusion guard always scans the default core entry and every statically or dynamically reachable emitted module for `__tcfapi` and `__gpp`. This guard runs even while the opt-in TCF/GPP entry is absent, and finding either token fails the size job.

## Budget changes

| entry | old | new | reason | PR |
| --- | --- | --- | --- | --- |
| dynamic | 2560 B | 2688 B | Shared patch registry and broader DOM insertion coverage for runtime blocking | #10 |
| network | 2048 B | 2304 B | Headroom for fetch, XHR, and beacon interception (measured 2039 B at landing) | #10 |
| consent-mode | none | 1560 B | New Consent Mode v2 entry | M1 PR9 |
| react | none | 1536 B | New React provider and hooks entry | M2 PR10 |
| react-headless | none | 3491 B | New headless primitives entry | M2 PR11 |
| react | 1536 B | 4608 B | Harness now counts imported package code (measurement change, no code growth) | fix(size) |
| banner | PENDING | 11264 B | Styled banner entry is now enforced | M2 PR12 |
| ui | PENDING | 13824 B initial, 16384 B total | Styled preferences and recall entry is now enforced | M2 PR12 |
| banner | `packages/react/dist/banner.mjs` | `scripts/size-scenarios/banner.ts` | entry changed to scenario, limit unchanged | M2 PR12 |
| ui | `packages/react/dist/ui.mjs` | `scripts/size-scenarios/ui.ts` | entry changed to scenario, limit unchanged | M2 PR12 |
| language | none | 954 B | New opt-in controller (measured 829 B at landing) | M2 PR13 |
| language | 954 B | 1050 B | Accept-Language q validation and regional fallback (measured 914 B, leaving 40 B (about 4%) under 954 B; 1050 B gives about 15% headroom) | M2 PR13 |
| nextjs client | none | 4370 B | New client provider bridge, measured 3800 B with Next.js, React, and React DOM external, plus 15% headroom | M3 PR14 |
| nextjs server | none | informational | Server-only App Router helpers and generated critical CSS | M3 PR14 |
| nextjs pages | none | 6225 B | Pages provider and request helpers, measured 5413 B plus 15% headroom (now 5379 B) | M3 PR15 |
| nextjs middleware | none | 1053 B | Edge region forwarding helper, first measured 915 B plus 15% headroom; 1003 B after explicit-provider parsing, about 5% headroom left | M3 PR15 |
| nextjs middleware | 1053 B | 1150 B | Explicit provider allowlist and forwarded header stripping, measured 1003 B | M3 PR15 (lead approved) |
| nextjs styles route | none | informational | Server-only CSS response helper for strict CSP deployments | M3 PR15 |
| scripts ga4 | none | 750 B | New preset, first measured 647 B (about 16% headroom) | M4 PR16 |
| scripts gtm | none | 805 B | New preset, first measured 676 B (about 19% headroom) | M4 PR16 |
| scripts google-ads | none | 810 B | New preset, first measured 702 B (about 15% headroom) | M4 PR16 |
| scripts ga4 | 750 B | 830 B | ID encoding hardening and full Consent Mode default, measured 719 B (about 15% headroom) | M4 PR16 (lead approved) |
| scripts gtm | 805 B | 915 B | ID encoding hardening and full Consent Mode default, measured 794 B (about 15% headroom) | M4 PR16 (lead approved) |
| scripts google-ads | 810 B | 890 B | ID encoding hardening and full Consent Mode default, measured 772 B (about 15% headroom) | M4 PR16 (lead approved) |
| scripts meta-pixel | none | 895 B | New preset, measured 776 B (about 15% headroom) | M4 PR17 |
| scripts clarity | none | 880 B | New preset, measured 764 B (about 15% headroom) | M4 PR17 |
| scripts posthog | none | 1060 B | New preset, measured 919 B (about 15% headroom) | M4 PR17 |
| scripts segment | none | 1055 B | New preset, measured 914 B (about 15% headroom) | M4 PR17 |
| scripts hotjar | none | 935 B | New preset, measured 811 B (about 15% headroom) | M4 PR17 |
| scripts linkedin | none | 880 B | New preset, measured 764 B (about 15% headroom) | M4 PR17 |
| scripts tiktok | none | 995 B | New preset, measured 861 B (about 16% headroom) | M4 PR17 |
