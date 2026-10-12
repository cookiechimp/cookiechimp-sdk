import { expect, type Page, test } from "@playwright/test";

const panel = (page: Page) => page.locator("div[data-cc-devtools]");

async function ready(page: Page) {
  await page.route("**://devtools.cookiechimp.test/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.goto("/devtools");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-devtools",
    "ready",
  );
}

test("devtools shows state and blocked scripts, and opening it sends no request", async ({
  page,
}) => {
  await ready(page);
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await panel(page).getByRole("button", { name: "CookieChimp" }).click();
  const dialog = panel(page).getByRole("dialog", {
    name: "CookieChimp devtools",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Config source");
  await expect(dialog).toContainText("local");
  await expect(dialog).toContainText("analytics: denied");
  await expect(dialog).toContainText(
    "script https://devtools.cookiechimp.test/gated.js [analytics]",
  );
  await expect(dialog).toContainText("Not connected (local mode)");
  await page.waitForTimeout(800);
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: "Accept all for devtools" }).click();
  await expect(dialog).toContainText("analytics: granted");
  await expect(dialog).toContainText("Nothing blocked");
  // Escape closes the panel while focus is inside it.
  await dialog.getByLabel("Simulated country").focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("devtools simulates region and GPC across a reload", async ({ page }) => {
  await ready(page);
  await panel(page).getByRole("button", { name: "CookieChimp" }).click();
  const dialog = panel(page).getByRole("dialog");
  await dialog.getByLabel("Simulated country").fill("us");
  await dialog.getByLabel("Simulated region").fill("ca");
  await dialog.getByLabel("Simulate GPC").check();
  await expect(dialog).toContainText("Simulated regulation: ccpa");
  await dialog.getByRole("button", { name: "Apply and reload" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-devtools",
    "ready",
  );
  await expect(page.getByTestId("simulation")).toHaveText(
    '{"region":{"country":"US","region":"CA"},"gpc":true}',
  );
  await panel(page).getByRole("button", { name: "CookieChimp" }).click();
  await expect(panel(page).getByRole("dialog")).toContainText("US-CA, GPC on");
  await panel(page)
    .getByRole("dialog")
    .getByRole("button", { name: "Clear simulation" })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-devtools",
    "ready",
  );
  await expect(page.getByTestId("simulation")).toHaveText("off");
});

test("a malformed stored simulation is ignored", async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    sessionStorage.setItem(
      "cc_devtools_simulation",
      '{"region":{"country":"<img src=x onerror=alert(1)>"}}',
    ),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-devtools",
    "ready",
  );
  await expect(page.getByTestId("simulation")).toHaveText("off");
  await expect(page.locator("img[src=x]")).toHaveCount(0);
});

test("devtools does not mount in a production build by default", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.goto("/devtools?guard=1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-devtools",
    "ready",
  );
  await expect(page.locator("div[data-cc-devtools]")).toHaveCount(0);
  expect(
    warnings.some((text) => text.includes("not mounted in production")),
  ).toBe(true);
});

test("a stored simulation is ignored in a production build by default", async ({
  page,
}) => {
  await page.goto("/devtools?guard=1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-devtools",
    "ready",
  );
  await page.evaluate(() =>
    sessionStorage.setItem(
      "cc_devtools_simulation",
      '{"region":{"country":"US","region":"CA"},"gpc":false}',
    ),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-devtools",
    "ready",
  );
  await expect(page.getByTestId("simulation")).toHaveText("off");
});
