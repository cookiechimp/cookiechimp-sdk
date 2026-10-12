import { expect, test } from "@playwright/test";

test("Germany requires an opt-in decision", async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-vercel-ip-country": "DE" },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("regulation")).toHaveText("gdpr");
  await expect(page.getByTestId("decision")).toHaveText("decision needed");
  await expect(page.getByTestId("regional-analytics")).toHaveText(
    "analytics off",
  );
  await context.close();
});

test("California Sec-GPC automatically opts out advertising", async ({
  browser,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "CA",
      "Sec-GPC": "1",
    },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("regulation")).toHaveText("ccpa");
  await expect(page.getByTestId("regional-advertising")).toHaveText(
    "advertising off",
  );
  await expect(page.getByTestId("regional-action")).toHaveText("gpc_auto");
  expect(
    (await context.cookies()).some(({ name }) => name === "cc_consent"),
  ).toBe(true);
  await context.close();
});
