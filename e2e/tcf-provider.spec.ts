import { expect, type Page, test } from "@playwright/test";

type Tcf = (
  command: string,
  version: number,
  callback: (data: unknown, ok: boolean) => void,
) => void;
const api = (page: Page, command: string) =>
  page.evaluate(
    (command) =>
      new Promise<{ data: unknown; ok: boolean }>((resolve) => {
        (window as typeof window & { __tcfapi: Tcf }).__tcfapi(
          command,
          2,
          (data, ok) => resolve({ data, ok }),
        );
      }),
    command,
  );

test("the disabled provider loads no GVL or TCF API", async ({ page }) => {
  let loads = 0;
  page.on("request", (request) => {
    if (request.url().includes("/tcf/gvl")) loads++;
  });
  await page.goto("/tcf-provider?mode=disabled");
  await expect(page.getByTestId("tcf-provider-status")).toHaveText("disabled");
  expect(loads).toBe(0);
  expect(
    await page.evaluate(
      () => typeof (window as { __tcfapi?: unknown }).__tcfapi,
    ),
  ).toBe("undefined");
});
test("the provider uses server-seeded consent, persists and cleans up", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tcf-provider");
  await expect(page.getByTestId("tcf-provider-status")).toHaveText("ready");
  expect((await api(page, "ping")).data).toMatchObject({
    cmpId: 123,
    cmpLoaded: true,
  });
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  expect((await api(page, "addEventListener")).data).toMatchObject({
    vendor: { consents: { "1": true, "2": true } },
  });
  await page.reload();
  await expect(page.getByTestId("tcf-provider-status")).toHaveText("ready");
  await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  expect((await api(page, "addEventListener")).data).toMatchObject({
    vendor: { consents: { "1": true, "2": true } },
  });
  await page.locator('[data-cc-part="recall"]').click();
  await expect(
    page.getByRole("region", { name: "Partners and purposes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Unmount TCF" }).click();
  expect(
    await page.evaluate(
      () => typeof (window as { __tcfapi?: unknown }).__tcfapi,
    ),
  ).toBe("undefined");
  expect(errors).toEqual([]);
});
for (const mode of ["missing-id", "invalid"]) {
  test(`${mode} fails closed while the regular banner still works`, async ({
    page,
  }) => {
    let loads = 0;
    page.on("request", (request) => {
      if (request.url().includes("/tcf/gvl")) loads++;
    });
    await page.goto(`/tcf-provider?mode=${mode}`);
    await expect(page.getByTestId("tcf-provider-status")).toHaveText("error");
    expect((await api(page, "ping")).data).toMatchObject({
      cmpStatus: "error",
    });
    const delivered = await page.evaluate(async () => {
      let delivered = false;
      (window as typeof window & { __tcfapi: Tcf }).__tcfapi(
        "addEventListener",
        2,
        () => {
          delivered = true;
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      return delivered;
    });
    expect(delivered).toBe(false);
    if (mode === "missing-id") expect(loads).toBe(0);
    await page.getByRole("button", { name: "Accept all cookies" }).click();
    await expect(page.locator('[data-cc-part="banner"]')).toHaveCount(0);
  });
}
