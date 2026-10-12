import { expect, test } from "@playwright/test";

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
