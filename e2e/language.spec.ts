import { expect, test } from "@playwright/test";

test("German is present in initial HTML without an English flash", async ({
  browser,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "Accept-Language": "de" },
  });
  const response = await context.request.get("/");
  const html = await response.text();
  expect(html).toContain("Alle Cookies akzeptieren");
  expect(html).not.toContain("Accept all cookies");
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    page.getByRole("button", { name: "Alle Cookies akzeptieren" }),
  ).toBeVisible();
  await context.close();
});

test("fr-CA falls back to French on the server", async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "Accept-Language": "fr-CA" },
  });
  const response = await context.request.get("/");
  expect(await response.text()).toContain("Tout accepter");
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await context.close();
});
