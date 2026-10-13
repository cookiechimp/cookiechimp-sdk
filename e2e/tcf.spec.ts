import { expect, type Page, test } from "@playwright/test";

type Api = (
  command: string,
  version: number,
  callback: (data: unknown, ok: boolean) => void,
  parameter?: unknown,
) => void;
type Event = { ok: boolean; eventStatus?: string; tcString?: string };

const tcf = (page: Page, command: string, parameter?: unknown) =>
  page.evaluate(
    ([command, parameter]) =>
      new Promise<[unknown, boolean]>((resolve) =>
        (window as unknown as { __tcfapi: Api }).__tcfapi(
          command as string,
          2,
          (data, ok) => resolve([data, ok]),
          parameter,
        ),
      ),
    [command, parameter] as const,
  );
const events = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __tcfEvents: Event[] }).__tcfEvents,
  );

async function open(page: Page, url: string, state = "ready") {
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-cc-tcf", state);
}

test("default bundle pages never define __tcfapi", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => typeof (window as { __tcfapi?: unknown }).__tcfapi,
    ),
  ).toBe("undefined");
});

test("the stub queues an early vendor listener and the CMP shows cmpuishown then useractioncomplete", async ({
  page,
}) => {
  await open(page, "/tcf");
  const [first] = await events(page);
  expect(first).toMatchObject({ ok: true, eventStatus: "cmpuishown" });
  // Core plus the mandatory disclosed vendors segment.
  expect(first?.tcString?.split(".")).toHaveLength(2);
  const [ping] = (await tcf(page, "ping")) as [
    Record<string, unknown>,
    boolean,
  ];
  expect(ping).toMatchObject({
    gdprApplies: true,
    cmpLoaded: true,
    cmpStatus: "loaded",
    cmpId: 300,
    gvlVersion: 150,
    apiVersion: "2.2",
  });
  await page.getByRole("button", { name: "Accept TCF purposes" }).click();
  await expect
    .poll(async () => (await events(page)).at(-1)?.eventStatus)
    .toBe("useractioncomplete");
  const [data] = (await tcf(page, "addEventListener")) as [
    {
      vendor: {
        consents: Record<string, boolean>;
        disclosedVendors: Record<string, boolean>;
      };
      purpose: { consents: Record<string, boolean> };
    },
    boolean,
  ];
  expect(data.vendor.consents).toEqual({ "1": true, "2": true });
  expect(data.vendor.disclosedVendors).toEqual({ "1": true, "2": true });
  expect(data.purpose.consents["1"]).toBe(true);
});

test("a stored decision loads as tcloaded on the next visit", async ({
  page,
}) => {
  await open(page, "/tcf");
  await page.getByRole("button", { name: "Reject TCF purposes" }).click();
  await expect
    .poll(async () => (await events(page)).at(-1)?.eventStatus)
    .toBe("useractioncomplete");
  await open(page, "/tcf");
  expect((await events(page))[0]).toMatchObject({ eventStatus: "tcloaded" });
  const [data] = (await tcf(page, "addEventListener")) as [
    { vendor: { consents: Record<string, boolean> } },
    boolean,
  ];
  expect(data.vendor.consents).toEqual({});
});

test("production without a cmpId fails closed: error status, vendors get nothing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await open(page, "/tcf?cmp=none", "disabled");
  expect(await events(page)).toEqual([]);
  const [ping] = (await tcf(page, "ping")) as [
    Record<string, unknown>,
    boolean,
  ];
  expect(ping).toMatchObject({ cmpStatus: "error", cmpLoaded: false });
  expect(errors.join(" ")).toMatch(
    /cmpId is required in production; TCF is disabled/,
  );
});

test("an invalid GVL fails closed", async ({ page }) => {
  page.on("console", () => {});
  await open(page, "/tcf?gvl=invalid", "disabled");
  expect(
    ((await tcf(page, "ping")) as [Record<string, unknown>])[0],
  ).toMatchObject({ cmpStatus: "error" });
});

test("outside GDPR the API reports gdprApplies false and no TC string", async ({
  page,
}) => {
  await open(page, "/tcf?region=US");
  const [data] = (await tcf(page, "addEventListener")) as [
    Record<string, unknown>,
    boolean,
  ];
  expect(data).toMatchObject({ gdprApplies: false, tcString: "" });
});

test("iframed vendors reach the CMP through the __tcfapiLocator frame", async ({
  page,
}) => {
  await open(page, "/tcf");
  const reply = await page.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve) => {
        const frame = document.createElement("iframe");
        frame.srcdoc = `<script>
          let w = window;
          while (w && !w.frames.__tcfapiLocator) w = w === w.parent ? null : w.parent;
          addEventListener("message", (e) => e.data && e.data.__tcfapiReturn && parent.postMessage({ done: e.data.__tcfapiReturn }, "*"));
          w.postMessage({ __tcfapiCall: { command: "ping", version: 2, callId: "f1" } }, "*");
        </script>`;
        addEventListener("message", (event) => {
          if (event.data?.done) resolve(event.data.done);
        });
        document.body.appendChild(frame);
      }),
  );
  expect(reply).toMatchObject({
    callId: "f1",
    success: true,
    returnValue: { cmpStatus: "loaded" },
  });
});
