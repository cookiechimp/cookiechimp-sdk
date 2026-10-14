import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("documented bootstrap waits for SDK imports and vendor consent", async ({
  page,
}) => {
  const root = resolve(import.meta.dirname, "..");
  const readme = await readFile(resolve(root, "README.md"), "utf8");
  const section = readme.split("### Install order for runtime blocking")[1];
  const snippet = /```html\n([\s\S]*?)```/.exec(section ?? "")?.[1];
  expect(snippet).toBeTruthy();
  // Expose only the consent action after the unmodified documented bootstrap.
  const html = snippet?.replace(
    "</script>",
    "globalThis.grantVendorConsent = () => consent.acceptAll();\n</script>",
  );
  let releaseImports: () => void = () => {};
  const importsReady = new Promise<void>((resolve) => {
    releaseImports = resolve;
  });
  let vendorRequests = 0;
  await page.route("https://vendor.example/**", async (route) => {
    vendorRequests += 1;
    await route.fulfill({
      contentType: "text/javascript",
      body: 'document.documentElement.dataset.vendorRan = "true";',
    });
  });
  await page.route("http://sdk-order.cookiechimp.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") {
      await route.fulfill({
        contentType: "text/html",
        body: `${html}<body><script>document.documentElement.dataset.parsed = "true";</script></body>`,
      });
      return;
    }
    const file = /^\/vendor\/cookiechimp\/core\/([\w-]+\.mjs)$/.exec(path)?.[1];
    if (!file) return route.abort();
    await importsReady;
    await route.fulfill({
      contentType: "text/javascript",
      body: await readFile(resolve(root, "packages/core/dist", file), "utf8"),
    });
  });
  try {
    await page.goto("http://sdk-order.cookiechimp.test/", {
      waitUntil: "commit",
    });
    await expect(page.locator("html")).toHaveAttribute("data-parsed", "true");
    // HTML parsing proceeds while SDK imports are deliberately stalled.
    expect(vendorRequests).toBe(0);
    await expect(page.locator('script[src*="vendor.example"]')).toHaveCount(0);
    releaseImports();
    await page.waitForLoadState("load");
    await expect(
      page.locator('script[data-cc-service="analytics-vendor"]'),
    ).toHaveAttribute("data-cc-blocked", "true");
    expect(vendorRequests).toBe(0);
    await page.evaluate(() => {
      (
        globalThis as typeof globalThis & { grantVendorConsent(): void }
      ).grantVendorConsent();
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-vendor-ran",
      "true",
    );
    expect(vendorRequests).toBe(1);
  } finally {
    releaseImports();
  }
});
