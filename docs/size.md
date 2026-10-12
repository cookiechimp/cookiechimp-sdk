# Size budgets

Run `pnpm size` to build the packages and print every budget from `size-budgets.json`. The command exits with a non-zero status if an available entry exceeds its limit or if opt-in TCF/GPP code is found in the default core bundle.

The harness uses Node's `zlib.gzip` with `level: 9`. Sizes are bytes, and limits use 1 KB = 1024 bytes. It sums the gzip size of each emitted JavaScript module, matching the bytes transferred as separately compressed files. `initial` follows static imports only. `total` follows static and dynamic imports. `extra` and `lazy` measure their opt-in entry and all reachable modules.

Until the M3 Next.js package exists, `fixtures/nextjs-app` is the empty stand-in application. Its page is the baseline and contributes zero package bytes. Package entry bundles are measured directly rather than subtracting Next.js framework chunks. This avoids build identifiers and framework chunk allocation changing the result, while measuring exactly the CookieChimp JavaScript added to that fixture. The fixture no-flash test remains part of the required end-to-end job.

Entries planned for later milestones remain visible as `PENDING`. File existence controls that state, so the same row becomes enforced automatically when its configured build output appears. The TCF/GPP row also scans the default core entry and its reachable chunks for its public API tokens once the opt-in entry exists.
