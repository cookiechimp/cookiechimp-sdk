import { expect, test } from "@playwright/test";

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
