import { expect, test } from "@playwright/test";

test("scripts run once and React can insert, remove and unmount their siblings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/gating-rerender");
  const runs = () =>
    page.evaluate(() => {
      const scope = window as typeof window & {
        __ccRuns?: number;
        __ccOtherRuns?: number;
      };
      return [scope.__ccRuns ?? 0, scope.__ccOtherRuns ?? 0];
    });
  expect(await runs()).toEqual([0, 0]);
  await page.getByRole("button", { name: "Grant scripts" }).click();
  await expect.poll(runs).toEqual([1, 1]);
  await page.getByRole("button", { name: "Toggle siblings" }).click();
  await expect(page.getByText("Before script")).toBeVisible();
  await expect(page.getByText("After script")).toBeVisible();
  await page.getByRole("button", { name: "Toggle siblings" }).click();
  await expect(page.getByText("Before script")).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke scripts" }).click();
  await page.getByRole("button", { name: "Grant scripts" }).click();
  expect(await runs()).toEqual([1, 1]);
  await page.getByRole("button", { name: "Unmount scripts" }).click();
  await expect(page.locator('[data-cc-part="gated-script"]')).toHaveCount(0);
  await expect(page.locator('[data-cc-activated="true"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
