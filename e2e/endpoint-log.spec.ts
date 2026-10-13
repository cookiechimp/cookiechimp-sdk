import { expect, type Page, test } from "@playwright/test";

// The fixture receiver keeps records in memory per `run`, so each test
// (and each repeat) gets its own store.
let API = "/api/consent";
let PAGE = "/endpoint-log";
type Stored = {
  id: string;
  record: Record<string, unknown>;
  contentType: string | null;
  cookie: string | null;
};

async function stored(page: Page): Promise<Stored[]> {
  const response = await page.request.get(API);
  return (await response.json()).records;
}

async function accept(page: Page) {
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  const cookie = (await page.context().cookies()).find(
    ({ name }) => name === "cc_consent",
  );
  expect(cookie?.value).toMatch(/^v1\./);
}

test.beforeEach(async ({ page }, info) => {
  const run = `${info.testId}-${info.repeatEachIndex}-${info.retry}`;
  API = `/api/consent?run=${run}`;
  PAGE = `/endpoint-log?run=${run}`;
  await page.request.delete(API);
});

test("accept stores one documented record on the same-origin endpoint without cookies", async ({
  page,
}) => {
  await page.goto(PAGE);
  await accept(page);
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  await expect(page.getByTestId("endpoint-log")).toHaveText("Queued: 0");
  const records = await stored(page);
  expect(records).toHaveLength(1);
  const [entry] = records as [Stored];
  // The page has a cc_consent cookie, but credentials are omitted.
  expect(entry.cookie).toBeNull();
  expect(entry.contentType).toBe("application/json");
  expect(Object.keys(entry.record).sort()).toEqual(
    [
      "action",
      "categories",
      "consentId",
      "gpc",
      "id",
      "language",
      "regulation",
      "services",
      "ts",
      "url",
    ].sort(),
  );
  expect(entry.record).toMatchObject({
    action: "accept_all",
    url: new URL(page.url()).origin,
  });
});

test("a failing endpoint keeps consent, retries, and stores the record once", async ({
  page,
}) => {
  await page.request.delete(`${API}&fail=2`);
  await page.goto(PAGE);
  await accept(page);
  await expect
    .poll(async () => (await stored(page)).length, { timeout: 10_000 })
    .toBe(1);
  await expect(page.getByTestId("endpoint-log")).toHaveText("Queued: 0", {
    timeout: 10_000,
  });
  expect(await stored(page)).toHaveLength(1);
});

test("an offline queue survives a reload and a resend is not duplicated", async ({
  page,
}) => {
  await page.route(`**/api/consent?run=*`, (route) =>
    route.abort("internetdisconnected"),
  );
  await page.goto(PAGE);
  await accept(page);
  await expect(page.getByTestId("endpoint-log")).toHaveText("Queued: 1");
  await page.unroute(`**/api/consent?run=*`);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Accept all cookies" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("endpoint-log")).toHaveText("Queued: 0", {
    timeout: 10_000,
  });
  // The unload flush and the reload may both deliver; the id dedupes them.
  expect(await stored(page)).toHaveLength(1);
});

test("page hide sends a cookie-less text/plain keepalive POST", async ({
  page,
}) => {
  await page.request.delete(`${API}&fail=1`);
  // A one-minute retry delay, so the only request that can deliver after the
  // forced failure is the page-hide flush (with the default 500 ms the timer
  // retry could win the race and send JSON).
  await page.goto(`${PAGE}&delay=60000`);
  // "Queued: 1" is also true while the first POST is still in flight, and a
  // hide during it reuses that request; wait for its 503 before hiding.
  const failed = page.waitForResponse(
    (response) =>
      response.url().includes("/api/consent") &&
      response.request().method() === "POST",
  );
  await accept(page);
  expect((await failed).status()).toBe(503);
  await expect(page.getByTestId("endpoint-log")).toHaveText("Queued: 1");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  await expect(page.getByTestId("endpoint-log")).toHaveText("Queued: 0");
  const [entry] = (await stored(page)) as [Stored];
  expect(entry.contentType).toMatch(/^text\/plain/);
  expect(entry.cookie).toBeNull();
});

test("a hostile response does not break the page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`**/api/consent?run=*`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: '{"__proto__":{"polluted":true},"accepted":"nope"}',
    }),
  );
  await page.goto(PAGE);
  await accept(page);
  await expect(page.getByTestId("endpoint-log")).toHaveText("Queued: 0");
  expect(
    await page.evaluate(
      () => (Object.prototype as { polluted?: unknown }).polluted,
    ),
  ).toBeUndefined();
  expect(errors).toEqual([]);
});

test("the provider endpoint prop sends static headers and still no cookies", async ({
  page,
}) => {
  await page.goto(PAGE.replace("/endpoint-log", "/endpoint-prop"));
  const preflights: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "OPTIONS") preflights.push(request.url());
  });
  await accept(page);
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  const [entry] = (await stored(page)) as [Stored & { site: string | null }];
  expect(entry.site).toBe("fixture");
  expect(entry.cookie).toBeNull();
  expect(entry.contentType).toBe("application/json");
  // Same-origin, so the custom header needs no CORS preflight.
  expect(preflights).toEqual([]);
});

test("with static headers, a page-hide flush keeps the headers and nothing is lost", async ({
  page,
}) => {
  await page.request.delete(`${API}&fail=1`);
  await page.goto(PAGE.replace("/endpoint-log", "/endpoint-prop"));
  const failed = page.waitForResponse(
    (response) =>
      response.url().includes("/api/consent") &&
      response.request().method() === "POST",
  );
  await accept(page);
  expect((await failed).status()).toBe(503);
  // The first POST fails (503); hiding the page flushes the retry at once.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  const [entry] = (await stored(page)) as [Stored & { site: string | null }];
  expect(entry.site).toBe("fixture");
  expect(entry.contentType).toBe("application/json");
  expect(entry.cookie).toBeNull();
});
