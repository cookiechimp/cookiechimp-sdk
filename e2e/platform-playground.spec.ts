import { expect, test } from "@playwright/test";

const address = "http://127.0.0.1:3104/platform.html";
test("all presets render the actual SDK and leave playground controls accessible", async ({
  page,
}) => {
  await page.goto(address);
  const gallery = page.getByRole("region", { name: "Demo presets" });
  await expect(gallery.getByRole("button")).toHaveCount(16);
  const demo = page.frameLocator("#sdk-preview");
  for (const name of [
    "Box / stacked",
    "Box / inline",
    "Box / wide",
    "Cloud / stacked",
    "Cloud / inline",
    "Bar / inline",
    "Bar / wide",
    "Vendor choices",
    "Categories only",
    "Dark side panel",
    "Opt-out notice",
    "Arabic / RTL",
    "Your branding",
    "Minimal notice",
    "Require a choice",
    "Without animation",
  ]) {
    await gallery.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const preferences = [
      "Vendor choices",
      "Categories only",
      "Dark side panel",
      "Arabic / RTL",
      "Without animation",
    ].includes(name);
    await expect(
      demo.locator(
        `[data-cc-part="${preferences ? "preferences" : "banner"}"]`,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open preferences", exact: true }),
    ).toBeEnabled();
    if (name === "Arabic / RTL")
      await expect(demo.locator("[data-cc-platform]")).toHaveAttribute(
        "dir",
        "rtl",
      );
    if (name === "Opt-out notice")
      await expect(
        page.getByRole("region", { name: "Current consent" }),
      ).toContainText('"analytics": true');
    if (name === "Require a choice")
      await expect(demo.locator('[data-cc-part="banner"]')).toHaveAttribute(
        "aria-modal",
        "true",
      );
  }
  await page
    .getByRole("button", { name: "Reset settings", exact: true })
    .click();
  await expect(demo.locator('[data-cc-part="banner"]')).toBeVisible();
});

test("saved vendor choices can be reloaded and the banner can be replayed", async ({
  page,
}) => {
  await page.goto(address);
  const demo = page.frameLocator("#sdk-preview");
  await demo
    .getByRole("button", { name: "Manage Preferences", exact: true })
    .click();
  const dialog = demo.getByRole("dialog", { name: "Cookie Settings" });
  await dialog.getByRole("button", { name: "Analytics", exact: true }).click();
  await dialog
    .getByRole("switch", { name: "Google Analytics", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save Preferences", exact: true })
    .click();
  const state = page.getByRole("region", { name: "Current consent" });
  await expect(state).toContainText('"google-analytics": true');
  await page
    .getByRole("button", { name: "Reload saved choices", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open preferences", exact: true }),
  ).toBeEnabled();
  await expect(demo.locator('[data-cc-part="banner"]')).toHaveCount(0);
  await expect(state).toContainText('"google-analytics": true');
  await page
    .getByRole("button", { name: "Open preferences", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(
    dialog.getByRole("switch", { name: "Google Analytics", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page
    .getByRole("button", { name: "Replay banner", exact: true })
    .click();
  await expect(demo.locator('[data-cc-part="banner"]')).toBeVisible();
  await expect(demo.locator('[data-cc-part="preferences"]')).toHaveCount(0);
  await expect(state).toContainText('"analytics": false');
});

test("branding, mobile preview, button visibility and exported JSON use the same configuration", async ({
  page,
}) => {
  await page.goto(address);
  const demo = page.frameLocator("#sdk-preview");
  await page
    .getByRole("button", { name: "Your branding", exact: true })
    .click();
  await expect(demo.locator(".cc-platform-logo-light")).toBeVisible();
  await expect(demo.locator(".cc-platform-logo-light")).toHaveAttribute(
    "src",
    /demo-logo-light.svg$/,
  );
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await expect(page.locator("#sdk-preview")).toHaveCSS("width", "390px");
  await page.locator("summary").filter({ hasText: "Buttons & footer" }).click();
  await page
    .getByRole("checkbox", { name: "Show banner accept", exact: true })
    .uncheck();
  await expect(demo.locator('[data-cc-part="banner-accept-all"]')).toHaveCount(
    0,
  );
  await page
    .locator("summary")
    .filter({ hasText: "Inspect the platform JSON" })
    .click();
  const json = JSON.parse(
    await page
      .getByRole("textbox", { name: "Platform JSON configuration" })
      .inputValue(),
  );
  expect(json.banners.bnrEU1.buttons.show_accept_btn).toBe(false);
  expect(json.banners.bnrEU1.theme.colors.btn_primary_bg).toBe("#12684a");
  expect(json.categories[1].services[0].name).toBe("Google Analytics");
});
