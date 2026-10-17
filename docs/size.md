# Size budgets

Run `pnpm size` to build the packages and print every budget from `size-budgets.json`. The command exits with a non-zero status if an available entry exceeds its limit or if opt-in TCF/GPP code is found in the default core bundle.

The harness bundles each entry's full import graph with Rolldown, using ESM output and minification, and then uses Node's `zlib.gzip` with `level: 9`. Bare workspace imports are resolved through Node package resolution and package exports. React, React DOM, the React JSX runtimes, and every package-declared peer dependency remain external because peers are provided by the host application. Sizes are bytes, and limits use 1 KB = 1024 bytes.

For `initial`, Rolldown emits separate dynamic chunks and the harness gzips only the entry chunk, so the measurement includes static imports but not dynamically imported code. For `total`, `extra`, and `lazy`, dynamic imports are inlined and the harness gzips the single complete bundle. This measures compression across the bundle instead of adding independently compressed source modules.

The styled React budgets use runnable source scenarios in `scripts/size-scenarios`. The banner scenario renders `ConsentProvider` and `CookieBanner`. The complete UI scenario renders `ConsentProvider`, `CookieBanner`, `CookiePreferences`, and `RecallButton`. This keeps the provider and its `createConsent` core runtime in the tree-shaken graph instead of measuring an isolated leaf entry. Both scenarios also declare `packages/react/styles.css` in their `css` list. The harness recursively resolves its `@import "@cookiechimp/tokens/css"`, gzips the combined CSS at level 9, and adds those bytes to the JavaScript result. The direct banner and UI distribution entries remain visible as informational rows, which print sizes but never fail a budget.

The checked budgets are the source-of-truth values below. Region header providers and built-in regulation tables live only in `@cookiechimp/core/regions`. The `@cookiechimp/core/sync` entry is enforced separately and is excluded from the default entry. Its row measures the standalone entry, which repeats the config normalisation that the default entry already ships; the marginal cost of `./sync` on top of `@cookiechimp/core` is 2395 B, mostly the platform bundle adapter, inside the SPEC.md 2.5 KB extra target (raised from 2 KB in M5 PR21 after lead review). Consent records live in `@cookiechimp/core/consent-log` (platform) and `@cookiechimp/core/endpoint` (self-hosted, local mode). Both are opt-in extras that share an internal record queue chunk and stay out of the default entry and out of `./sync`; each row measures the entry with that shared chunk included. Declarative gating lives in `@cookiechimp/core/gate`, and runtime blocking lives in `@cookiechimp/core/dynamic`. Their budgets are CookieChimp guards (SPEC.md sets no number for them), and both stay out of the default entry. The fetch, XHR, and beacon blocker lives in `@cookiechimp/core/network`, has a 2304 B gzip budget, and also stays out of the default entry. The `@cookiechimp/cli` budgets measure a Node tool that never ships to browsers; they guard against accidental dependency growth.

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
| react provider and hooks | initial | 5320 |
| Next.js client provider bridge | initial | 5270 |
| Next.js server entry | extra | INFO |
| Next.js Pages client wrapper | initial | 7045 |
| Next.js middleware region helper | extra | 1150 |
| Next.js styles route | extra | INFO |
| react headless primitives | extra | 3491 |
| banner only | initial | 11264 |
| banner distribution entry | initial | 11264 |
| banner, preferences, recall initial | initial | 13824 |
| UI distribution entry initial | initial | 13824 |
| banner, preferences, recall total | total | 16384 |
| UI distribution entry total | total | 16384 |
| connected sync client | extra | 4355 |
| consent log | extra | 2490 |
| self-hosted endpoint log | extra | 2450 |
| GA4 preset | extra | 830 |
| GTM preset | extra | 915 |
| Google Ads preset | extra | 890 |
| Meta Pixel preset | extra | 1005 |
| Clarity preset | extra | 980 |
| PostHog preset | extra | 1175 |
| Segment preset | extra | 1140 |
| Hotjar preset | extra | 1025 |
| LinkedIn Insight preset | extra | 970 |
| TikTok Pixel preset | extra | 1095 |
| Devtools panel | extra | 3295 |
| Devtools simulation reader | extra | 660 |
| CLI binary | total | 8800 |
| CLI programmatic API | total | 8905 |
| GPP stub | extra | 925 |
| GPP US sections module | lazy | 2810 |
| TCF stub | extra | 645 |
| TCF core module | lazy | 4555 |
| TCF vendor list UI | extra | 4295 |
| TCF labels (largest locale, el) | extra | 940 |
| TCF/GPP module | lazy | 12288 |
| TCF provider bootstrap | initial | 780 |
| TCF/GPP with provider full import graph | total | 12288 |
| platform JSON category and vendor UI | total | 24576 |
<!-- size-budgets:end -->

The opt-in `@cookiechimp/react/platform` entry includes the shared JSON adapter,
category/vendor disclosures and `platform.css` (which imports the base SDK CSS).
Its complete JavaScript and CSS graph has a separate 24 KB budget. This rendering
does not ship in the default banner entry, and existing budgets are unchanged.

Until the M3 Next.js package exists, `fixtures/nextjs-app` is the empty stand-in application. Its page is the baseline and contributes zero package bytes. Source scenario measurement avoids build identifiers and framework chunk allocation changing the result while measuring the complete CookieChimp graph used by a realistic render. Fixture-delta measurement is deferred to M7. The fixture no-flash test remains part of the required end-to-end job.

Entries planned for later milestones remain visible as `PENDING` only when their paths are on the harness's explicit allowlist. A missing path outside that allowlist fails with a non-zero exit, preventing a typo from remaining pending indefinitely. File existence controls the allowlisted state, so the same row becomes enforced automatically when its configured build output appears.

GPP lives in two opt-in subpaths. `@cookiechimp/core/gpp-stub` is the `__gpp` stub that publishers inline before vendor tags (SPEC.md requires under 1 KB; the `gppStubScript` inline string measures 761 B gzip on its own). `@cookiechimp/core/gpp` is the lazy US sections encoder and full CMP API. TCF lives in `@cookiechimp/core/tcf-stub` (the inline `__tcfapi` stub; the `tcfStubScript()` string alone is 494 B gzip) and the lazy `@cookiechimp/core/tcf`. The TCF/GPP row is the SPEC.md 12 KB cap. Since M7 PR39 it measures the real combined total (`tcf.mjs` plus `gpp.mjs`, the react `tcf.mjs` and `tcf.css`, through the new `alsoEntries` field), so CI fails if the opt-in IAB code together passes 12 KB; the GPP module (2430 B) plus the TCF module (3960 B) plus the TCF vendor list UI (3733 B with `tcf.css`) is 10123 B, inside that cap with about 18% headroom. The vendor list UI lives in `@cookiechimp/react/tcf` with its own `@cookiechimp/react/tcf.css`, so it stays out of the styled UI entry and the banner CSS budgets. The TCF core module row is the tighter guard with about 15% headroom.

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
| scripts meta-pixel | none | 895 B | New preset with vendor consent API mapping, measured 874 B (about 2% headroom) | M4 PR17 |
| scripts clarity | none | 880 B | New preset with vendor consent API mapping, measured 852 B (about 3% headroom) | M4 PR17 |
| scripts posthog | none | 1060 B | New preset with vendor consent API mapping, measured 1022 B (about 4% headroom) | M4 PR17 |
| scripts segment | none | 1055 B | New preset with vendor consent API mapping, measured 989 B (about 7% headroom) | M4 PR17 |
| scripts hotjar | none | 935 B | New preset with vendor consent API mapping, measured 889 B (about 5% headroom) | M4 PR17 |
| scripts linkedin | none | 880 B | New preset with vendor consent API mapping, measured 842 B (about 5% headroom) | M4 PR17 |
| scripts tiktok | none | 995 B | New preset with vendor consent API mapping, measured 952 B (about 5% headroom) | M4 PR17 |
| scripts meta-pixel | 895 B | 1005 B | Vendor consent API sync, measured 874 B (about 15% headroom) | M4 PR17 (lead approved) |
| scripts clarity | 880 B | 980 B | Vendor consent API sync, measured 852 B (about 15% headroom) | M4 PR17 (lead approved) |
| scripts posthog | 1060 B | 1175 B | Vendor consent API sync, measured 1022 B (about 15% headroom) | M4 PR17 (lead approved) |
| scripts segment | 1055 B | 1140 B | Vendor consent API sync, measured 989 B (about 15% headroom) | M4 PR17 (lead approved) |
| scripts hotjar | 935 B | 1025 B | Vendor consent API sync, measured 889 B (about 15% headroom) | M4 PR17 (lead approved) |
| scripts linkedin | 880 B | 970 B | Vendor consent API sync, measured 842 B (about 15% headroom) | M4 PR17 (lead approved) |
| scripts tiktok | 995 B | 1095 B | Vendor consent API sync, measured 952 B (about 15% headroom) | M4 PR17 (lead approved) |
| devtools | none | 3295 B | New opt-in development panel, measured 2896 B (about 14% headroom) | M4 PR18 |
| devtools simulation | none | 585 B | New simulation reader subpath with the fail-closed production guard, measured 574 B (about 2% headroom) | M4 PR18 |
| devtools simulation | 585 B | 660 B | isDev fail-closed guard, measured 574 B (about 15% headroom) | M4 PR19 (lead approved) |
| cli | none | 5140 B | New `cookiechimp` init and doctor binary, Node builtins external, measured 4467 B (about 15% headroom) | M4 PR19 |
| cli api | none | 5195 B | New programmatic CLI entry, Node builtins external, measured 4514 B (about 15% headroom) | M4 PR19 |
| cli | 5140 B | 8800 B | `link` and `pull` added: token from env or stdin only, paginated accounts API, offline bundle validation, `.env.local` upsert. Network code lives in a remote chunk (about 2.7 kB gzip) loaded by dynamic import, so `init` and `doctor` never load it. Total including every chunk measured 7648 B (about 15% headroom). Node-only tool, never shipped to browsers | M5 PR23 |
| cli api | 5195 B | 8905 B | Same `link` and `pull` code, re-exported from the programmatic entry. Measured 7743 B (about 15% headroom) | M5 PR23 |
| react | 4608 B | 5320 B | `endpoint` prop. Row now measures the initial chunk (what every app downloads); `@cookiechimp/core/endpoint` loads by dynamic import only when the prop is set and is guarded by its own row. Initial 4334 B to 4624 B (+290 B), about 15% headroom. With the lazy chunk inlined it is 6484 B | M5 PR30 |
| nextjs client | 4370 B | 4800 B | `endpoint` passthrough, initial chunk as above: 3868 B to 4176 B (+308 B, from the React provider), about 15% headroom | M5 PR30 |
| nextjs pages | 6225 B | 6585 B | `endpoint` passthrough, initial chunk: 5419 B to 5726 B (+307 B), about 15% headroom | M5 PR30 |
| endpoint | 2135 B | 2450 B | Optional static `headers` with fail-closed validation: 1865 B to 2130 B (+265 B), about 15% headroom | M5 PR30 |
| nextjs server | informational | informational | `getServerConfig` and `CookieChimpProvider` `projectId`: server fetch with `revalidate: 300`, reusing the `./sync` adapter. Server-only (never shipped to browsers): 10309 B to 11875 B (+1566 B). Browser rows unchanged: nextjs client 4176 B, nextjs pages 5726 B | M5 PR31 |
| nextjs client | 4800 B | 5270 B | Client revalidation after hydration (`ClientProvider` `sync` seed, `./sync` loaded by dynamic import) and the plain-text copy mapping: 4176 B to 4580 B (+404 B), about 15% headroom | M5 PR32 |
| nextjs pages | 6585 B | 7045 B | Same shared client provider code: 5726 B to 6126 B (+400 B), about 15% headroom | M5 PR32 |
| sync | 4355 B | 4355 B | `etag` seed option and the idle-callback timeout: 3785 B to 3847 B (+62 B), 13% headroom, budget unchanged | M5 PR32 |
| nextjs server | informational | informational | Dashboard cookie settings and the client sync seed: 11875 B to 13696 B (+1821 B; with code splitting off this row also inlines the client entry and its lazy `./sync`). Server-only | M5 PR32 |
| sync | 2048 B | 4355 B | Connected config client for the shared platform offline bundle: adapter, fetch, cache, idle revalidation, untrusted payload validation and timeout. Standalone entry measured 3785 B (about 15% headroom); marginal cost over core 2395 B, above the SPEC 2 KB extra target (flagged for lead review) | M5 PR20 |
| SPEC sync extra target | 2 KB | 2.5 KB | SPEC.md target only, no checked limit change: `./sync` marginal cost over core is 2395 B, accepted by the lead after M5 PR20 | M5 PR21 (lead approved) |
| consent log | none | 2490 B | New opt-in consent record POST subpath: platform record mapping, persisted queue, capped backoff, untrusted response parsing, beacon on hide and fail-closed guards. Measured 2166 B (about 15% headroom) | M5 PR21 |
| endpoint | none | 2135 B | New opt-in self-hosted consent record subpath for local mode: endpoint validation, record mapping and the shared record queue chunk. Measured 1854 B (about 15% headroom) | M5 PR22 |
| consent log | 2490 B | 2490 B | Limit unchanged. Queue moved into a shared chunk and the page-hide flush switched from sendBeacon to a cookie-less keepalive fetch: measured 2166 B to 2215 B (about 12% headroom) | M5 PR22 |
| gpp stub | none | 925 B | New opt-in `__gpp` stub subpath (ping, listener registration, queue, `__gppLocator` frame, postMessage bridge). Measured 809 B (about 14% headroom), inside the SPEC.md 1 KB stub target | M6 PR33 |
| gpp | none | 2810 B | New opt-in lazy GPP module: header and usnat, usca, usva, usco, usut, usct encoders with GPC segment, consent mapping and full CMP API. Measured 2430 B (about 16% headroom), inside the SPEC.md 12 KB TCF/GPP cap | M6 PR33 |
| tcf stub | none | 645 B | New opt-in `__tcfapi` stub subpath (ping, queue, `__tcfapiLocator` frame, postMessage bridge). Measured 560 B (about 15% headroom) | M6 PR34 |
| tcf | none | 3300 B | New opt-in lazy TCF v2.3 module: TC string encoder with the mandatory disclosed vendors segment, GVL validation, cmpId rules and the CMP API. Measured 2868 B (about 15% headroom). The TCF/GPP 12 KB SPEC cap row was pending and now measures this entry (2868 B) | M6 PR34 |
| tcf | 3300 B | 4010 B | Vendor UI support: explicit per-purpose and per-vendor choices with right to object, ID-only persistence tied to the consent decision, GVL purpose and vendor names, UI subscribe. 2868 B to 3487 B (+619 B), about 15% headroom | M6 PR35 |
| react tcf | none | 2555 B | New `@cookiechimp/react/tcf` windowed vendor list, measured with `tcf.css`: 2221 B (about 15% headroom). `CookiePreferences` gains a `children` slot: banner + preferences + recall 9349 B to 9355 B initial, 11209 B to 11213 B total, budgets unchanged | M6 PR35 |
| react | 5320 B | 5320 B | Limit unchanged. Opt-in `gpp` prop: `@cookiechimp/core/gpp` loads by dynamic import only when set and is guarded by its own row. Initial chunk 4624 B to 4701 B (+77 B), about 12% headroom | M6 PR36 |
| nextjs client | 5270 B | 5270 B | Limit unchanged. `gpp` passthrough: 4580 B to 4654 B (+74 B), about 12% headroom | M6 PR36 |
| nextjs pages | 7045 B | 7045 B | Limit unchanged. `gpp` passthrough: 6126 B to 6204 B (+78 B), about 12% headroom | M6 PR36 |
| nextjs server | informational | informational | `GppStub` inlines the stub source and `gpp` passthrough. Server-only (never shipped as a module to browsers; the inline stub itself is guarded by the gpp stub row): 13696 B to 15946 B (+2250 B) | M6 PR36 |
| TCF core module | 4010 B | 4555 B | GVL parsing now keeps the vendor disclosures TCF policy requires in the CMP UI (special purposes, features, data categories, retention, https-only privacy and legitimate interest links, device storage fields): 3487 B to 3960 B (+473 B). Limit reset to about 15% headroom | M6 PR37 |
| TCF vendor list UI | 2555 B | 4295 B | Vendor names become Details buttons opening a per-vendor details panel (purposes, retention, links, storage) with its CSS, and focused-row pinning so focus survives windowing, and rows no longer wrap at narrow widths: 2221 B to 3733 B (+1512 B). Limit reset to about 15% headroom. TCF/GPP total 10123 B of the 12288 B SPEC cap | M6 PR37 |
| TCF labels (largest locale, el) | n/a | 940 B | New opt-in `@cookiechimp/translations/tcf/<locale>` entries. Largest is el at 815 B; limit about 15% headroom over the largest. Every existing per-locale bundle (`dist/<locale>.mjs` and `.cjs`) is byte-identical to main, and the row asserts the TCF keys stay out of `dist/el.mjs` | M6 PR38 |
| TCF/GPP module | 12288 B | 12288 B | Limit unchanged. Row now sums the TCF core, GPP and TCF vendor UI entries plus `tcf.css` (`alsoEntries`) instead of measuring `tcf.mjs` alone: 3960 B to 10123 B measured, about 17% headroom. Watch item: 2165 B left under the SPEC cap | M7 PR39 |
| GPP later state sections | 2810 B | 2810 B | Limit unchanged. Ten additional state schemas and state routing: 2430 B to 2673 B. Stub: 809 B to 859 B, inside 925 B. Combined TCF/GPP: 10123 B to 10366 B, inside 12288 B, leaving 1922 B. Default bundles remain unchanged | GPP follow-up |
| TCF provider bootstrap and full graph | new | 780 B / 12288 B | Dedicated opt-in provider entry: 666 B initial. A new full-graph row includes its dynamic core import plus TCF, GPP and vendor UI/CSS, deduplicated and measured at 10127 B. Existing conservative component sum remains guarded at 10366 B of 12288 B. No existing budget changed; default bundles unchanged | TCF provider follow-up |
| TCF disclosure follow-up | unchanged | unchanged | Current GVL text and illustration support: TCF core 4042 B, vendor UI with CSS 3909 B, conservative component sum 10624 B and full IAB graph 10347 B under 12288 B. Provider bootstrap 663 B under 780 B. All existing budgets and default-bundle exclusions remain enforced | TCF disclosure follow-up |
