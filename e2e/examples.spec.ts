import { expect, type Page, test } from "@playwright/test";

const examples = [
  ["App Router", "http://127.0.0.1:3101"],
  ["Pages Router", "http://127.0.0.1:3102"],
] as const;
const vendor = /googletagmanager\.com|google-analytics\.com/;

async function recordVendor(page: Page) {
  const hits: string[] = [];
  await page.route(vendor, (route) => {
    hits.push(route.request().url());
    return route.abort();
  });
  return hits;
}

for (const [name, url] of examples) {
  test.describe(`${name} example`, () => {
    test("no GA4 request before consent, then loads after accept and stays decided", async ({
      page,
    }) => {
      const hits = await recordVendor(page);
      await page.goto(url);
      const banner = page.locator('[data-cc-part="banner"]');
      await expect(banner).toBeVisible();
      await expect(page.getByTestId("analytics-status")).toHaveText(
        "Analytics is not allowed.",
      );
      await expect(
        page.locator("script[data-cc-category=analytics]"),
      ).toHaveAttribute("type", "text/plain");
      expect(hits).toEqual([]);
      await page.getByRole("button", { name: "Accept all cookies" }).click();
      await expect(banner).toBeHidden();
      await expect(page.getByTestId("analytics-status")).toHaveText(
        "Analytics is allowed.",
      );
      await expect.poll(() => hits.length).toBeGreaterThan(0);
      expect(hits[0]).toContain("G-EXAMPLE123");

      const response = await page.request.get(url);
      // The server reads the cookie: a returning visitor gets no banner in HTML.
      const html = await page.goto(url).then((r) => r?.text());
      expect(response.ok()).toBe(true);
      expect(html).not.toContain('data-cc-part="banner"');
      await expect(
        page.getByRole("button", { name: "Review cookie choices" }),
      ).toBeVisible();
    });

    test("reject keeps GA4 blocked across reloads, and preferences can revisit it", async ({
      page,
    }) => {
      const hits = await recordVendor(page);
      await page.goto(url);
      await page.getByRole("button", { name: "Reject optional" }).click();
      await page.reload();
      await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
      await expect(page.getByTestId("analytics-status")).toHaveText(
        "Analytics is not allowed.",
      );
      await page
        .getByRole("button", { name: "Change cookie settings" })
        .click();
      await expect(
        page.locator('[data-cc-part="preferences"]').first(),
      ).toBeVisible();
      expect(hits).toEqual([]);
    });
  });
}
