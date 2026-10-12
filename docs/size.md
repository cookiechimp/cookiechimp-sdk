# Size budgets

Run `pnpm size` to build the packages and print every budget from `size-budgets.json`. The command exits with a non-zero status if an available entry exceeds its limit or if opt-in TCF/GPP code is found in the default core bundle.

The harness uses Node's `zlib.gzip` with `level: 9`. Sizes are bytes, and limits use 1 KB = 1024 bytes. It sums the gzip size of each emitted JavaScript module, matching the bytes transferred as separately compressed files. `initial` follows static imports only. `total` follows static and dynamic imports. `extra` and `lazy` measure their opt-in entry and all reachable modules.

The checked budgets are the source-of-truth values below. Region header providers and built-in regulation tables live only in `@cookiechimp/core/regions`. The `@cookiechimp/core/sync` entry is enforced separately and is excluded from the default entry. Declarative gating lives in `@cookiechimp/core/gate`, and runtime blocking lives in `@cookiechimp/core/dynamic`. Their budgets are CookieChimp guards (SPEC.md sets no number for them), and both stay out of the default entry. The fetch, XHR, and beacon blocker lives in `@cookiechimp/core/network`, has a 2304 B gzip budget, and also stays out of the default entry.

<!-- size-budgets:start -->
| Name | Kind | Limit (bytes) |
|---|---:|---:|
| declarative script and iframe gating | extra | 2048 |
| runtime script and iframe blocking | extra | 2688 |
| network blocking | extra | 2304 |
| consent-mode | extra | 1560 |
| core initial | initial | 4096 |
| core total | total | 5120 |
| banner only | initial | 11264 |
| banner, preferences, recall initial | initial | 13824 |
| banner, preferences, recall total | total | 16384 |
| connected sync client | extra | 2048 |
| TCF/GPP module | lazy | 12288 |
<!-- size-budgets:end -->

Until the M3 Next.js package exists, `fixtures/nextjs-app` is the empty stand-in application. Its page is the baseline and contributes zero package bytes. Direct entry measurement is approved for the current milestones. Fixture-delta measurement is deferred to M7. Direct measurement avoids build identifiers and framework chunk allocation changing the result, while measuring exactly the CookieChimp JavaScript added to that fixture. The fixture no-flash test remains part of the required end-to-end job.

Entries planned for later milestones remain visible as `PENDING` only when their paths are on the harness's explicit allowlist for banner, preferences and recall, and TCF/GPP outputs. A missing path outside that allowlist fails with a non-zero exit, preventing a typo from remaining pending indefinitely. File existence controls the allowlisted state, so the same row becomes enforced automatically when its configured build output appears.

The TCF/GPP exclusion guard always scans the default core entry and every statically or dynamically reachable emitted module for `__tcfapi` and `__gpp`. This guard runs even while the opt-in TCF/GPP entry is absent, and finding either token fails the size job.

## Budget changes

| entry | old | new | reason | PR |
| --- | --- | --- | --- | --- |
| dynamic | 2560 B | 2688 B | Shared patch registry and broader DOM insertion coverage for runtime blocking | #10 |
| network | 2048 B | 2304 B | Headroom for fetch, XHR, and beacon interception (measured 2039 B at landing) | #10 |
| consent-mode | none | 1560 B | New Consent Mode v2 entry | M1 PR9 |
