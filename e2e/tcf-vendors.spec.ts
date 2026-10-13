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
