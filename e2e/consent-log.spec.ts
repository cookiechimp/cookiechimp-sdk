import { expect, type Page, type Request, test } from "@playwright/test";

const SYNC = "https://api.cookiechimp.test/api/v1/mobile-sdk/sync/acctREDACTED";
const DOCUMENTED = [
  "client_id",
  "consent_banner_hashid",
  "created_at",
  "gpc_preference",
  "language_code",
  "platform",
  "url",
  "user_preferences",
  "uuid",
  "visitor_action",
];

function confirmAll(request: Request) {
  const { consents } = JSON.parse(request.postData() ?? "{}");
  return JSON.stringify({
    synced_count: consents.length,
    failed_count: 0,
    synced: consents.map((item: { client_id: string }) => ({
      client_id: item.client_id,
      server_id: 1,
    })),
    failed: [],
  });
}

async function accept(page: Page) {
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  const cookie = (await page.context().cookies()).find(
    ({ name }) => name === "cc_consent",
  );
  expect(cookie?.value).toMatch(/^v1\./);
}

test("accept sends one documented record without cookies", async ({ page }) => {
  const requests: Request[] = [];
  await page.route(SYNC, async (route) => {
    requests.push(route.request());
    await route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: confirmAll(route.request()),
    });
  });
  await page.goto("/consent-log");
  await accept(page);
  await expect(page.getByTestId("consent-log")).toHaveText("Queued: 0");
  expect(requests).toHaveLength(1);
  const request = requests[0] as Request;
  expect(request.method()).toBe("POST");
  const headers = await request.allHeaders();
  expect(headers.cookie).toBeUndefined();
  const [record] = JSON.parse(request.postData() ?? "{}").consents;
  expect(Object.keys(record).sort()).toEqual(DOCUMENTED);
  expect(record.url).toBe(new URL(page.url()).origin);
  expect(record).toMatchObject({ platform: "web", visitor_action: "consent" });
});

test("a 500 keeps consent and retries with backoff", async ({ page }) => {
  let calls = 0;
  await page.route(SYNC, async (route) => {
    calls += 1;
    await route.fulfill(
      calls === 1
        ? {
            status: 500,
            contentType: "text/plain",
            headers: { "access-control-allow-origin": "*" },
            body: "error",
          }
        : {
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: confirmAll(route.request()),
          },
    );
  });
  await page.goto("/consent-log");
  await accept(page);
  await expect(page.getByTestId("consent-log")).toHaveText("Queued: 0", {
    timeout: 10_000,
  });
  expect(calls).toBe(2);
});

test("offline queue survives a reload and drains later", async ({ page }) => {
  // Refuse the unload beacon so the queue must persist across the reload.
  await page.addInitScript(() => {
    navigator.sendBeacon = () => false;
  });
  await page.route(SYNC, (route) => route.abort("internetdisconnected"));
  await page.goto("/consent-log");
  await accept(page);
  await expect(page.getByTestId("consent-log")).toHaveText("Queued: 1");
  await page.unroute(SYNC);
  let delivered = 0;
  await page.route(SYNC, async (route) => {
    delivered += 1;
    await route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: confirmAll(route.request()),
    });
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Accept all cookies" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("consent-log")).toHaveText("Queued: 0", {
    timeout: 10_000,
  });
  expect(delivered).toBeGreaterThan(0);
});

test("a hostile response does not break the page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(SYNC, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: '{"__proto__":{"polluted":true},"synced":"nope","failed":{"client_id":{}}}',
    }),
  );
  await page.goto("/consent-log");
  await accept(page);
  await expect(page.getByTestId("consent-log")).toHaveText("Queued: 0");
  expect(await page.evaluate(() => ({}) as Record<string, unknown>)).toEqual(
    {},
  );
  expect(
    await page.evaluate(
      () => (Object.prototype as { polluted?: unknown }).polluted,
    ),
  ).toBeUndefined();
  expect(errors).toEqual([]);
});

test("page hide flushes the queue as a text/plain beacon", async ({ page }) => {
  await page.route(SYNC, (route) => route.abort("internetdisconnected"));
  await page.goto("/consent-log");
  await accept(page);
  await expect(page.getByTestId("consent-log")).toHaveText("Queued: 1");
  await page.unroute(SYNC);
  const beacon = page.waitForRequest(SYNC);
  await page.route(SYNC, (route) =>
    route.fulfill({ headers: { "access-control-allow-origin": "*" } }),
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const request = await beacon;
  const headers = await request.allHeaders();
  expect(headers["content-type"]).toMatch(/^text\/plain/);
  expect(headers.cookie).toBeUndefined();
  expect(JSON.parse(request.postData() ?? "{}").consents).toHaveLength(1);
});
