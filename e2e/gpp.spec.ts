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

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-cc-gpp", "ready");
}

test("default bundle pages never define __gpp", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading").first()).toBeVisible();
  expect(
    await page.evaluate(() => typeof (window as { __gpp?: unknown }).__gpp),
  ).toBe("undefined");
});

test("the inline stub answers early vendor calls and hands over to the CMP API", async ({
  page,
}) => {
  await ready(page, "/gpp?region=CA");
  const events = await page.evaluate(
    () => (window as unknown as { __gppEvents: string[] }).__gppEvents,
  );
  expect(events.slice(0, 3)).toEqual([
    "listenerRegistered:true",
    'cmpStatus:"loaded"',
    'signalStatus:"ready"',
  ]);
  const ping = (await gpp(page, "ping")) as Record<string, unknown>;
  expect(ping).toMatchObject({
    gppVersion: "1.1",
    cmpStatus: "loaded",
    signalStatus: "ready",
    applicableSections: [8],
    cmpId: 0,
  });
  expect(ping.gppString).toMatch(/^DBABBg~[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(await gpp(page, "getField", "usca.SaleOptOutNotice")).toBe(1);
});

test("opting out and back in updates usca with the IAB event order", async ({
  page,
}) => {
  await ready(page, "/gpp?region=CA");
  await page.evaluate(() => {
    (window as unknown as { __gppEvents: string[] }).__gppEvents.length = 0;
  });
  await page.getByRole("button", { name: "Opt out of sale" }).click();
  await expect.poll(() => gpp(page, "getField", "usca.SaleOptOut")).toBe(1);
  expect(await gpp(page, "getField", "usca.SharingOptOut")).toBe(1);
  expect(
    (
      await page.evaluate(
        () => (window as unknown as { __gppEvents: string[] }).__gppEvents,
      )
    ).map((event) => event.split(":")[0]),
  ).toEqual(["signalStatus", "usca", "signalStatus"]);
  await page.getByRole("button", { name: "Allow sale" }).click();
  await expect.poll(() => gpp(page, "getField", "usca.SaleOptOut")).toBe(2);
});

test("GPC forces the opt-out and sets the GPC segment", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
      get: () => true,
    }),
  );
  await ready(page, "/gpp?region=CO");
  await page.getByRole("button", { name: "Allow sale" }).click();
  expect(await gpp(page, "getField", "usco.SaleOptOut")).toBe(1);
  expect(await gpp(page, "getField", "usco.Gpc")).toBe(true);
});

test("national approach and non-state regions use usnat; outside the US no section applies", async ({
  page,
}) => {
  await ready(page, "/gpp?region=CA&approach=national");
  expect(await gpp(page, "ping")).toMatchObject({ applicableSections: [7] });
  await ready(page, "/gpp?region=TX");
  expect(await gpp(page, "hasSection", "usnat")).toBe(true);
  await ready(page, "/gpp");
  expect(await gpp(page, "ping")).toMatchObject({
    applicableSections: [-1],
    gppString: "",
  });
});

test("iframed vendors reach the CMP through the __gppLocator frame", async ({
  page,
}) => {
  await ready(page, "/gpp?region=CA");
  const reply = await page.evaluate(
    () =>
      new Promise<{
        callId: number;
        success: boolean;
        returnValue: { cmpStatus: string };
      }>((resolve) => {
        const frame = document.createElement("iframe");
        frame.srcdoc = `<script>
            let w = window;
            while (w && !w.frames.__gppLocator) w = w === w.parent ? null : w.parent;
            addEventListener("message", (e) => e.data && e.data.__gppReturn && parent.postMessage({ done: e.data.__gppReturn }, "*"));
            w.postMessage({ __gppCall: { command: "ping", callId: 41 } }, "*");
          </script>`;
        addEventListener("message", (event) => {
          if (event.data?.done) resolve(event.data.done);
        });
        document.body.appendChild(frame);
      }),
  );
  expect(reply).toMatchObject({
    callId: 41,
    success: true,
    returnValue: { cmpStatus: "loaded" },
  });
});
