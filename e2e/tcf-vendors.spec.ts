import { expect, type Page, test } from "@playwright/test";

type Api = (
  command: string,
  version: number,
  callback: (data: unknown, ok: boolean) => void,
) => void;
const tcData = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{
        eventStatus: string;
        tcString: string;
        vendor: {
          consents: Record<string, boolean>;
          legitimateInterests: Record<string, boolean>;
        };
      }>((resolve) =>
        (window as unknown as { __tcfapi: Api }).__tcfapi(
          "addEventListener",
          2,
          (data) => resolve(data as never),
        ),
      ),
  );

async function open(page: Page) {
  await page.goto("/tcf-vendors");
  await expect(page.locator("html")).toHaveAttribute("data-cc-tcf", "ready");
  await page.getByRole("button", { name: "Manage vendors" }).click();
  await expect(page.locator('[data-cc-part="tcf"]')).toBeVisible();
}

test("1200 vendors render through a window, not all at once", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByText("Vendors (1200)")).toBeVisible();
  const count = await page.locator(".cc-tcf__vendor").count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(20);
  await page.locator('[data-cc-part="tcf-vendors"]').evaluate((el) => {
    el.scrollTop = 40 * 600;
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(page.getByText("Partner 601", { exact: true })).toBeVisible();
  expect(await page.locator(".cc-tcf__vendor").count()).toBeLessThan(20);
});

test("per-vendor consent and right to object reach __tcfapi and persist across reloads", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("searchbox", { name: "Search vendors" })
    .fill("Partner 12");
  await page
    .getByRole("checkbox", { name: "Consent: Partner 12", exact: true })
    .check();
  await page
    .getByRole("searchbox", { name: "Search vendors" })
    .fill("Partner 13");
  await page
    .getByRole("checkbox", {
      name: "Legitimate interest: Partner 13",
      exact: true,
    })
    .uncheck();
  await page.getByRole("button", { name: "Save choices" }).click();
  await expect(page.getByRole("status")).toHaveText("Choices saved");
  const data = await tcData(page);
  expect(data.eventStatus).toBe("useractioncomplete");
  expect(data.vendor.consents).toEqual({ "12": true });
  expect(data.vendor.legitimateInterests["13"]).toBeUndefined();
  expect(data.vendor.legitimateInterests["11"]).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-cc-tcf", "ready");
  const restored = await tcData(page);
  expect(restored.eventStatus).toBe("tcloaded");
  expect(restored.vendor.consents).toEqual({ "12": true });
});

test("accept all from the vendor panel consents every disclosed vendor", async ({
  page,
}) => {
  await open(page);
  await page
    .locator('[data-cc-part="tcf"]')
    .getByRole("button", { name: "Accept all" })
    .click();
  const data = await tcData(page);
  expect(Object.keys(data.vendor.consents)).toHaveLength(1200);
});

test("keyboard users can reach and toggle vendor checkboxes", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("searchbox", { name: "Search vendors" }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  expect(focused).toMatch(/^(Consent|Legitimate interest): Partner 1$/);
  await page.keyboard.press("Space");
  expect(
    await page.evaluate(
      () => (document.activeElement as HTMLInputElement).checked,
    ),
  ).toBe(focused?.startsWith("Consent"));
});

test("vendor details disclose purposes, retention, links and storage", async ({
  page,
}) => {
  await open(page);
  const details = page.getByRole("button", {
    name: "Details: Partner 3",
    exact: true,
  });
  await details.click();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("region", { name: "Partner 3", exact: true });
  await expect(panel).toBeFocused();
  await expect(panel).toContainText("Purposes (consent)");
  await expect(panel).toContainText(
    "Store and/or access information on a device",
  );
  await expect(panel).toContainText("Measure advertising performance");
  await expect(panel).toContainText("Standard retention: Days: 30");
  await expect(panel).toContainText("Maximum cookie lifetime (days): 90");
  await expect(panel).toContainText(
    "Uses other device storage or access methods",
  );
  await expect(
    panel.getByRole("link", { name: "Privacy policy" }),
  ).toHaveAttribute("href", "https://partner3.example/privacy");
  await expect(
    panel.getByRole("link", { name: "Legitimate interest claim" }),
  ).toHaveAttribute("href", "https://partner3.example/li");
  await expect(
    panel.getByRole("link", { name: "Storage disclosure" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(details).toBeFocused();
  await expect(page.locator('[data-cc-part="tcf"]')).toBeVisible();
});

test("keyboard focus survives scrolling the focused row out of view", async ({
  page,
}) => {
  await open(page);
  const box = page.getByRole("checkbox", {
    name: "Consent: Partner 2",
    exact: true,
  });
  await box.focus();
  await page.locator('[data-cc-part="tcf-vendors"]').evaluate((el) => {
    el.scrollTop = 40 * 900;
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(page.getByText("Partner 901", { exact: true })).toBeVisible();
  await expect(box).toBeFocused();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  // The vendor name (Details button) precedes its checkboxes in the row.
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Details: Partner 2", exact: true }),
  ).toBeFocused();
});

test("TCF labels from @cookiechimp/translations render in German", async ({
  page,
}) => {
  await page.goto("/tcf-vendors?lang=de");
  await expect(page.locator("html")).toHaveAttribute("data-cc-tcf", "ready");
  await page.getByRole("button", { name: "Manage vendors" }).click();
  const tcf = page.getByRole("region", { name: "Partner und Zwecke" });
  await expect(tcf).toBeVisible();
  await expect(tcf.getByText("Anbieter (1200)")).toBeVisible();
  await expect(
    tcf.getByRole("searchbox", { name: "Anbieter suchen" }),
  ).toBeVisible();
  await tcf
    .getByRole("button", { name: "Details: Partner 3", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Partner 3", exact: true });
  await expect(panel).toContainText("Standardspeicherdauer: Tage: 30");
  await expect(panel).toContainText("Maximale Cookie-Laufzeit (Tage): 90");
  await expect(
    panel.getByRole("link", { name: "Datenschutzerklärung" }),
  ).toHaveAttribute("href", "https://partner3.example/privacy");
  await page.keyboard.press("Escape");
  await tcf.getByRole("button", { name: "Alle akzeptieren" }).click();
  await expect(tcf.getByRole("status")).toHaveText("Auswahl gespeichert");
});
