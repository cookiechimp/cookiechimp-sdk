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
      // Inspect records so removal and insertion in one callback are not hidden.
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

test("no-flash: first visit keeps the server banner through hydration", async ({
  page,
}) => {
  const response = await page.request.get("/");
  expect(await response.text()).toContain('data-cc-part="banner"');
  await observeBannerChanges(page, true);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-hydrated",
    "true",
  );
  await expect(page.locator('[data-cc-part="banner"]')).toBeVisible();
  expect(await page.evaluate(() => window.__ccBannerChanges)).toEqual([]);
});

test("no-flash: returning visitor never inserts the consent banner", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const setupPage = await context.newPage();
  await setupPage.goto("/");
  await setupPage.getByRole("button", { name: "Accept all cookies" }).click();
  await setupPage.close();

  const response = await context.request.get("/");
  expect(await response.text()).not.toContain('data-cc-part="banner"');
  const page = await context.newPage();
  await observeBannerChanges(page, false);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-hydrated",
    "true",
  );
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ccBannerChanges)).toEqual([]);
  await context.close();
});

test("first visit shows the consent banner and accepting hides it", async ({
  page,
}) => {
  await page.route(/\.css(?:\?|$)/, (route) => route.abort());
  await page.goto("/");
  const banner = page.locator('[data-cc-part="banner"]');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveCSS("position", "fixed");
  await expect(banner).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
});

test("keyboard opens and closes the modal with restored focus", async ({
  page,
}) => {
  await page.goto("/");
  const customize = page.getByRole("button", { name: "Customize" });
  await customize.focus();
  await page.keyboard.press("Enter");
  const preferences = page.getByRole("dialog", { name: "Cookie preferences" });
  await expect(preferences).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Shift+Tab");
  await expect(
    preferences.getByRole("button", { name: "Close" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(preferences).toHaveCount(0);
  await expect(customize).toBeFocused();
});

test("returning visitor has no consent banner before or after hydration", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Accept all cookies" }).click();

  const response = await context.request.get("/");
  const html = await response.text();
  expect(html).not.toContain('data-cc-part="banner"');
  expect(html).toContain("data-cookiechimp-critical");
  await page.reload();
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  await context.close();
});

test("gated markup matches before consent hydration", async ({ browser }) => {
  const serverContext = await browser.newContext({ javaScriptEnabled: false });
  const serverPage = await serverContext.newPage();
  await serverPage.goto("/");
  const serverMarkup = await serverPage
    .getByTestId("gated-elements")
    .evaluate((element) => element.outerHTML);
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto("/");
  await clientPage.waitForLoadState("networkidle");
  expect(
    await clientPage
      .getByTestId("gated-elements")
      .evaluate((element) => element.outerHTML),
  ).toBe(serverMarkup);
  await serverContext.close();
  await clientContext.close();
});

for (const [name, extraHTTPHeaders] of [
  ["DE", { "x-vercel-ip-country": "DE" }],
  [
    "US-CA GPC",
    {
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "CA",
      "Sec-GPC": "1",
    },
  ],
] as const)
  test(`${name} consent region matches before and after hydration`, async ({
    browser,
  }) => {
    const withoutJavaScript = await browser.newContext({
      javaScriptEnabled: false,
      extraHTTPHeaders,
    });
    const serverPage = await withoutJavaScript.newPage();
    await serverPage.goto("/");
    const serverRegion = serverPage.getByTestId("consent-region");
    await expect(serverRegion).toBeVisible();
    const serverMarkup = await serverRegion.evaluate(
      (element) => element.outerHTML,
    );
    const serverBox = await serverRegion.boundingBox();

    const withJavaScript = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders,
    });
    const hydratedPage = await withJavaScript.newPage();
    await hydratedPage.goto("/");
    const hydratedRegion = hydratedPage.getByTestId("consent-region");
    await expect(hydratedRegion).toBeVisible();
    await hydratedPage.waitForLoadState("networkidle");

    expect(await hydratedRegion.evaluate((element) => element.outerHTML)).toBe(
      serverMarkup,
    );
    expect(await hydratedRegion.boundingBox()).toEqual(serverBox);

    await withoutJavaScript.close();
    await withJavaScript.close();
  });
