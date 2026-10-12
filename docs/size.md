# Size budgets

Run `pnpm size` to build the packages and print every budget from `size-budgets.json`. The command exits with a non-zero status if an available entry exceeds its limit or if opt-in TCF/GPP code is found in the default core bundle.

The harness uses Node's `zlib.gzip` with `level: 9`. Sizes are bytes, and limits use 1 KB = 1024 bytes. It sums the gzip size of each emitted JavaScript module, matching the bytes transferred as separately compressed files. `initial` follows static imports only. `total` follows static and dynamic imports. `extra` and `lazy` measure their opt-in entry and all reachable modules.

The SPEC ceilings remain 7 KB initial and 9 KB total for core. The repository enforces tighter working budgets of 4 KB initial and 5 KB total. The `@cookiechimp/core/sync` entry is enforced separately against the SPEC limit of 2 KB extra and is excluded from the default entry.

Until the M3 Next.js package exists, `fixtures/nextjs-app` is the empty stand-in application. Its page is the baseline and contributes zero package bytes. Direct entry measurement is approved for the current milestones. Fixture-delta measurement is deferred to M7. Direct measurement avoids build identifiers and framework chunk allocation changing the result, while measuring exactly the CookieChimp JavaScript added to that fixture. The fixture no-flash test remains part of the required end-to-end job.

Entries planned for later milestones remain visible as `PENDING` only when their paths are on the harness's explicit allowlist for banner, preferences and recall, and TCF/GPP outputs. A missing path outside that allowlist fails with a non-zero exit, preventing a typo from remaining pending indefinitely. File existence controls the allowlisted state, so the same row becomes enforced automatically when its configured build output appears.

The TCF/GPP exclusion guard always scans the default core entry and every statically or dynamically reachable emitted module for `__tcfapi` and `__gpp`. This guard runs even while the opt-in TCF/GPP entry is absent, and finding either token fails the size job.
