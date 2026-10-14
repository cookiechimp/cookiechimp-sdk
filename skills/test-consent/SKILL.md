---
name: test-consent
description: Write tests that prove a CookieChimp site loads no tracking before consent and respects reject, accept, revoke and Global Privacy Control. Use when asked to test cookie consent, verify GDPR compliance of tags, or add Playwright or Vitest coverage for a consent banner.
---

# Test consent behaviour

## Unit tests (Vitest)

```ts
import { createConsent } from "@cookiechimp/core";
import { expect, it } from "vitest";

it("starts with optional categories off under GDPR", () => {
  const consent = createConsent({
    categories: { analytics: false, marketing: false },
    regulation: "gdpr",
  });
  expect(consent.needsDecision).toBe(true);
  expect(consent.has("analytics")).toBe(false);
  consent.acceptAll();
  expect(consent.has("analytics")).toBe(true);
});
```

## End-to-end (Playwright)

Record every request to a vendor host, and fail if one starts before consent:

```ts
import { expect, test } from "@playwright/test";

const vendor = /googletagmanager\.com|google-analytics\.com|facebook\.net/;

test("no tracking before consent, tags load after accept", async ({ page }) => {
  const hits: string[] = [];
  await page.route(vendor, (route) => {
    hits.push(route.request().url());
    return route.abort();
  });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(hits).toEqual([]);
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await expect.poll(() => hits.length).toBeGreaterThan(0);
});
```

Also cover:

- **Reject:** click "Reject optional", reload, and check that the banner stays
  closed and `hits` stays empty.
- **Returning visitor:** after a decision, reload and check that the banner does
  not appear in the server HTML (no flash).
- **GPC:** use a context with `extraHTTPHeaders: { "Sec-GPC": "1" }`, and add
  `navigator.globalPrivacyControl` through `addInitScript`, when GPC is
  enabled. Advertising and marketing must stay off.
- **Revoke:** open preferences with the recall button, turn analytics off,
  and assert the vendor consent API was called or a reload is required.
- Abort vendor requests in tests so CI never calls real trackers.
