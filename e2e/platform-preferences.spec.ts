import { expect, test } from "@playwright/test";

test("platform JSON drives vendor details and persisted per-vendor consent", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3104/platform.html?preview=1");
  await page
    .getByRole("button", { name: "Manage Preferences", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cookie Settings" });
  await expect(dialog).toBeVisible();
  const consentId = dialog.locator('[data-cc-part="preferences-consent-id"]');
  const originalId = await consentId.innerText();
  expect(originalId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  await expect(
    page.getByRole("region", { name: "Live consent JSON" }),
  ).toContainText(originalId);
  await expect(
    dialog.getByRole("switch", { name: "Essential", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Analytics", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Google Analytics", exact: true })
    .click();
  await expect(dialog.getByText("_ga", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("2 years", { exact: true }).first(),
  ).toBeVisible();
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
  await expect(consentId).toHaveText(originalId);
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

test("platform motion defaults on, can be disabled, and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("http://127.0.0.1:3104/platform.html?preview=1");
  const provider = page.locator("[data-cc-platform]");
  await expect(provider).toHaveAttribute("data-cc-motion", "on");
  await page
    .getByRole("button", { name: "Manage cookie preferences", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cookie Settings" });
  const panel = dialog.locator(".cc-preferences__panel");
  await expect(panel).toHaveCSS("animation-name", "cc-platform-rise");
  const category = dialog.locator(".cc-platform-category").filter({
    has: page.getByRole("button", { name: "Analytics", exact: true }),
  });
  const details = category.locator(":scope > .cc-disclosure__content");
  await expect(details).toHaveAttribute("inert", "");
  await category
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await expect(details).not.toHaveAttribute("inert", "");
  await expect(details).toHaveCSS("transition-duration", "0.22s, 0.16s, 0.22s");
  await expect(
    dialog.getByRole("button", { name: "Microsoft Clarity", exact: true }),
  ).toBeVisible();
  await category
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await expect(details).toHaveAttribute("inert", "");
  await category
    .getByRole("button", { name: "Analytics", exact: true })
    .press("Tab");
  await category
    .getByRole("switch", { name: "Analytics", exact: true })
    .press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Marketing", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("checkbox", { name: "Animate interactions" }).uncheck();
  await expect(provider).toHaveAttribute("data-cc-motion", "off");
  await page
    .getByRole("button", { name: "Manage cookie preferences", exact: true })
    .click();
  await expect(panel).toHaveCSS("animation-name", "none");
  await expect(details).toHaveCSS("transition-duration", "0s, 0s, 0s");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("checkbox", { name: "Animate interactions" }).check();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Manage cookie preferences", exact: true })
    .click();
  await expect(provider).toHaveAttribute("data-cc-motion", "on");
  await expect(panel).toHaveCSS("animation-name", "none");
  await expect(details).toHaveCSS("transition-duration", "0s, 0s, 0s");
  await expect(
    dialog
      .getByRole("switch", { name: "Analytics", exact: true })
      .locator("span"),
  ).toHaveCSS("transition-duration", "0s");
});
