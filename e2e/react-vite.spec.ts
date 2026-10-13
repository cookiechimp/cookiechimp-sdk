import { expect, test } from "@playwright/test";

const url = "http://127.0.0.1:3104";
for (const choice of ["accept", "reject"] as const) {
  test(`plain React example ${choice}s and persists, with accessible recall and no duplicate script`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const runs = () =>
      page.evaluate(
        () =>
          (window as typeof window & { __exampleAnalyticsRuns?: number })
            .__exampleAnalyticsRuns,
      );
    await page.goto(url);
    await expect(page.locator('[data-cc-part="banner"]')).toBeVisible();
    expect(await runs()).toBeUndefined();
    await page
      .getByRole("button", {
        name: choice === "accept" ? "Accept all cookies" : "Reject optional",
      })
      .click();
    await expect(page.getByTestId("analytics-status")).toHaveText(
      choice === "accept"
        ? "Analytics is allowed."
        : "Analytics is not allowed.",
    );
    if (choice === "accept") await expect.poll(runs).toBe(1);
    else expect(await runs()).toBeUndefined();
    await page.reload();
    await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
    if (choice === "accept") await expect.poll(runs).toBe(1);
    else expect(await runs()).toBeUndefined();
    await page.getByRole("button", { name: "Review cookie choices" }).click();
    await expect(
      page.getByRole("dialog", { name: "Cookie preferences" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Change cookie settings" }).click();
    await expect(
      page.getByRole("dialog", { name: "Cookie preferences" }),
    ).toBeVisible();
    if (choice === "accept") expect(await runs()).toBe(1);
    expect(errors).toEqual([]);
  });
}
