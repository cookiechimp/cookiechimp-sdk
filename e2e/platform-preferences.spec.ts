import { expect, test } from "@playwright/test";

test("platform JSON drives vendor details and persisted per-vendor consent", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3104/platform.html");
  await page
    .getByRole("button", { name: "Manage Preferences", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cookie Settings" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("switch", { name: "Essential", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Analytics", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Google Analytics", exact: true })
    .click();
  await expect(dialog.getByText("_ga", { exact: true })).toBeVisible();
  await expect(dialog.getByText("2 years", { exact: true })).toBeVisible();
  await dialog
    .getByRole("switch", { name: "Google Analytics", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save Preferences", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Manage cookie preferences", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(
    dialog.getByRole("switch", { name: "Google Analytics", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Reject All", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Live consent JSON" }),
  ).toContainText('"google-analytics": false');
});
