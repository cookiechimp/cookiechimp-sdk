import { expect, type Page, test } from "@playwright/test";

type Gpp = (
  command: string,
  callback: (data: unknown, ok: boolean) => void,
  parameter?: unknown,
) => void;
const gpp = (page: Page, command: string, parameter?: unknown) =>
  page.evaluate(
    ([command, parameter]) =>
      new Promise<unknown>((resolve) =>
        (window as unknown as { __gpp: Gpp }).__gpp(
          command as string,
          (data) => resolve(data),
          parameter,
        ),
      ),
    [command, parameter] as const,
  );

test("CookieChimpProvider gpp prop: stub in the HTML, lazy API after hydration", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  const response = await page.goto("/gpp-provider");
  const html = (await response?.text()) ?? "";
  expect(html).toContain("data-cookiechimp-gpp");
  await expect
    .poll(() =>
      gpp(page, "ping").then((p) => (p as { cmpStatus: string }).cmpStatus),
    )
    .toBe("loaded");
  expect(await gpp(page, "ping")).toMatchObject({
    applicableSections: [8],
    signalStatus: "ready",
  });
  expect(await gpp(page, "getField", "usca.SaleOptOutNotice")).toBe(1);
  const events = await page.evaluate(
    () => (window as unknown as { __gppEvents: string[] }).__gppEvents,
  );
  expect(events.slice(0, 3)).toEqual([
    "listenerRegistered",
    "cmpStatus",
    "signalStatus",
  ]);
  await page.getByRole("button", { name: "Opt out of sale" }).click();
  await expect.poll(() => gpp(page, "getField", "usca.SaleOptOut")).toBe(1);
  await page.getByRole("button", { name: "Allow sale" }).click();
  await expect.poll(() => gpp(page, "getField", "usca.SaleOptOut")).toBe(2);
});

test("without the gpp prop no stub is rendered and __gpp never appears", async ({
  page,
}) => {
  const response = await page.goto("/gpp-provider?off=1");
  expect((await response?.text()) ?? "").not.toContain("data-cookiechimp-gpp");
  await expect(page.getByRole("button", { name: "Allow sale" })).toBeVisible();
  await page.getByRole("button", { name: "Allow sale" }).click();
  expect(
    await page.evaluate(() => typeof (window as { __gpp?: unknown }).__gpp),
  ).toBe("undefined");
});
