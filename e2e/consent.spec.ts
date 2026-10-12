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
  expect(cookie).toMatchObject({ path: "/", sameSite: "Lax", secure: false });
  expect((cookie?.expires ?? 0) - Date.now() / 1000).toBeGreaterThan(
    179 * 24 * 60 * 60,
  );
  const payload = JSON.parse(
    Buffer.from(cookie?.value.slice(3) ?? "", "base64url").toString(),
  );
  expect(payload).toMatchObject({
    schemaVersion: 1,
    consentId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
    ts: expect.any(String),
  });

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
