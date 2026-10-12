import { expect, test } from "@playwright/test";

async function observeBannerChanges(
  page: import("@playwright/test").Page,
  serverHasBanner: boolean,
) {
  await page.addInitScript((hasServerBanner) => {
    const selector = '[data-cc-part="banner"]';
    let initialized = !hasServerBanner;
    let present = false;
    const changes: string[] = [];
    new MutationObserver((records) => {
      const next = document.querySelector(selector) !== null;
      if (!initialized && next) {
        initialized = true;
        present = true;
        return;
      }
      if (initialized && next !== present) {
        changes.push(next ? "inserted" : "removed");
        present = next;
      }
      for (const record of records) {
        for (const node of record.removedNodes)
          if (
            node instanceof Element &&
            (node.matches(selector) || node.querySelector(selector))
          )
            changes.push("removed");
        for (const node of record.addedNodes)
          if (
            initialized &&
            node instanceof Element &&
            (node.matches(selector) || node.querySelector(selector))
          )
            changes.push("inserted");
      }
    }).observe(document, { childList: true, subtree: true });
    Object.defineProperty(window, "__ccBannerChanges", { value: changes });
  }, serverHasBanner);
}

test("no-flash: pages router first visit keeps the server banner through hydration", async ({
  page,
}) => {
  const response = await page.request.get("/legacy");
  expect(await response.text()).toContain('data-cc-part="banner"');
  await observeBannerChanges(page, true);
  await page.goto("/legacy");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-hydrated",
    "true",
  );
  await expect(page.locator('[data-cc-part="banner"]')).toBeVisible();
  expect(await page.evaluate(() => window.__ccBannerChanges)).toEqual([]);
});

test("no-flash: pages router returning visitor never inserts the consent banner", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const setupPage = await context.newPage();
  await setupPage.goto("/legacy");
  await setupPage.getByRole("button", { name: "Accept all cookies" }).click();
  await setupPage.close();

  const response = await context.request.get("/legacy");
  expect(await response.text()).not.toContain('data-cc-part="banner"');
  const page = await context.newPage();
  await observeBannerChanges(page, false);
  await page.goto("/legacy");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-hydrated",
    "true",
  );
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ccBannerChanges)).toEqual([]);
  await context.close();
});

test("middleware forwards only the configured provider region", async ({
  browser,
}) => {
  const forwarded = await browser.newContext({
    extraHTTPHeaders: {
      "cf-ipcountry": "DE",
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "CA",
    },
  });
  const forwardedPage = await forwarded.newPage();
  await forwardedPage.goto("/legacy");
  await expect(forwardedPage.getByTestId("region")).toHaveText("DE");
  await expect(forwardedPage.getByTestId("regulation")).toHaveText("gdpr");
  await forwarded.close();

  const fallback = await browser.newContext();
  const fallbackPage = await fallback.newPage();
  await fallbackPage.goto("/legacy");
  await expect(fallbackPage.getByTestId("region")).toHaveText("null");
  await fallback.close();
});

test("strict CSP page loads stylesRoute CSS without policy violations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.violatedDirective}:${event.blockedURI}`);
    });
    Object.defineProperty(window, "__ccCspViolations", { value: violations });
  });
  await page.goto("/strict");
  const banner = page.locator('[data-cc-part="banner"]');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveCSS("position", "fixed");
  await expect(banner).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect(await page.evaluate(() => window.__ccCspViolations)).toEqual([]);
});

test("stylesRoute serves CSS with an ETag and supports revalidation", async ({
  request,
}) => {
  const response = await request.get("/cookiechimp.css");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/css");
  const etag = response.headers().etag;
  expect(etag).toBeTruthy();
  const revalidated = await request.get("/cookiechimp.css", {
    headers: { "If-None-Match": etag as string },
  });
  expect(revalidated.status()).toBe(304);
});
