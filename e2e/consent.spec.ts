import { expect, test } from "@playwright/test";

test("acceptance persists after reload", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Analytics declined",
  );
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Analytics accepted",
  );
  const cookie = (await context.cookies()).find(
    ({ name }) => name === "cc_consent",
  );
  expect(cookie?.value).toMatch(/^v1\./);

  await page.reload();
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Analytics accepted",
  );
});

test("a service decision persists after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("service-status")).toHaveText(
    "Analytics demo declined",
  );
  await page.getByRole("button", { name: "Toggle analytics demo" }).click();
  await expect(page.getByTestId("service-status")).toHaveText(
    "Analytics demo accepted",
  );
  await page.reload();
  await expect(page.getByTestId("service-status")).toHaveText(
    "Analytics demo accepted",
  );
});
