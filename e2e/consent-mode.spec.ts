import { expect, test } from "@playwright/test";

test("Consent Mode default precedes tags and acceptance sends an update", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-consent-mode",
    "ready",
  );
  const result = await page.evaluate(() => {
    const layer = (
      window as typeof window & { dataLayer: ArrayLike<unknown>[] }
    ).dataLayer;
    return {
      entries: layer.map((entry) => Array.from(entry)),
      kinds: layer.map((entry) => Object.prototype.toString.call(entry)),
    };
  });
  const { entries, kinds } = result;
  expect(entries.filter((entry) => entry[1] === "default")).toHaveLength(1);
  expect(kinds[0]).toBe("[object Arguments]");
  expect(entries[0]).toMatchObject([
    "consent",
    "default",
    { ad_storage: "denied", analytics_storage: "denied" },
  ]);
  expect(entries.findIndex((entry) => entry[0] === "event")).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { dataLayer: ArrayLike<unknown>[] }
        ).dataLayer
          .map((entry) => Array.from(entry))
          .some(
            (entry) =>
              entry[0] === "consent" &&
              entry[1] === "update" &&
              (entry[2] as { analytics_storage?: string }).analytics_storage ===
                "granted",
          ),
      ),
    )
    .toBe(true);
});
