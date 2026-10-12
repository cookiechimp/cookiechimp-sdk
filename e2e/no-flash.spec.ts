import { expect, test } from "@playwright/test";

test("consent region matches before and after hydration", async ({
  browser,
}) => {
  const withoutJavaScript = await browser.newContext({
    javaScriptEnabled: false,
  });
  const serverPage = await withoutJavaScript.newPage();
  await serverPage.goto("/");
  const serverRegion = serverPage.getByTestId("consent-region");
  await expect(serverRegion).toBeVisible();
  const serverMarkup = await serverRegion.evaluate(
    (element) => element.outerHTML,
  );
  const serverBox = await serverRegion.boundingBox();

  const withJavaScript = await browser.newContext({ javaScriptEnabled: true });
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
