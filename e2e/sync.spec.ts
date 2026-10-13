import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, type Route, test } from "@playwright/test";

const API =
  "https://api.cookiechimp.test/api/v1/mobile-sdk/offline/acctREDACTED";
// Platform offline bundle fixture (redacted), shared with the core unit tests.
const FIXTURE = readFileSync(
  resolve("packages/core/src/fixtures/platform-offline-bundle.json"),
  "utf8",
);
const config = (version: string, label: string) => {
  const value = JSON.parse(FIXTURE);
  value.cache_version = version;
  value.categories[1].translations.en.name = label;
  return value;
};
const section = (page: Page) => page.locator("section[data-cc-sync]");

async function api(page: Page, handler: (route: Route) => Promise<void>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  await page.route(`${API}**`, async (route) => {
    calls.push({
      url: route.request().url(),
      headers: route.request().headers(),
    });
    await handler(route);
  });
  return calls;
}

test("dashboard config arrives after first render and is cached for the next load", async ({
  page,
}) => {
  const calls = await api(page, (route) =>
    route.fulfill({ json: config("1", "Dashboard analytics") }),
  );
  await page.goto("/sync");
  await expect(section(page)).toHaveAttribute("data-cc-sync", "ready");
  await expect(section(page)).toHaveAttribute(
    "data-cc-sync-source",
    "dashboard",
  );
  await expect(section(page)).toContainText("Dashboard analytics");
  await expect(section(page)).toContainText("We value your privacy");
  expect(calls[0]?.headers.authorization).toBeUndefined();
  expect(calls[0]?.headers.cookie).toBeUndefined();

  await page.unroute(`${API}**`);
  const offline = await api(page, (route) =>
    route.abort("internetdisconnected"),
  );
  await page.reload();
  await expect(section(page)).toContainText("Dashboard analytics");
  await expect(section(page)).toHaveAttribute("data-cc-sync", "error");
  await expect(section(page)).toHaveAttribute("data-cc-sync-source", "cache");
  expect(offline.length).toBe(1);
});

test("a revalidation sends If-None-Match and a 304 keeps the cache", async ({
  page,
}) => {
  let first = true;
  const calls = await api(page, async (route) => {
    if (first) {
      first = false;
      await route.fulfill({ json: config("7", "Seven") });
    } else await route.fulfill({ status: 304 });
  });
  await page.goto("/sync");
  await expect(section(page)).toContainText("Seven");
  await page.reload();
  await expect(section(page)).toHaveAttribute("data-cc-sync", "ready");
  await expect(section(page)).toContainText("Seven");
  expect(calls[1]?.headers["if-none-match"]).toBe('"7"');
});

test("the region selects the GDPR banner with German copy", async ({
  page,
}) => {
  await api(page, (route) =>
    route.fulfill({ contentType: "application/json", body: FIXTURE }),
  );
  await page.goto("/sync?region=DE&locale=de-DE");
  await expect(section(page)).toHaveAttribute("data-cc-sync-banner", "bnrEU1");
  await expect(section(page)).toContainText(
    "Wir respektieren Ihre Privatsphäre",
  );
  await expect(section(page)).toContainText("Statistik");
});

test("a hanging API never blocks first render and times out to local config", async ({
  page,
}) => {
  await api(page, () => new Promise(() => {}));
  await page.goto("/sync");
  await expect(section(page)).toContainText("Local analytics");
  await expect(section(page)).toHaveAttribute("data-cc-sync-source", "local");
  await expect(page.getByTestId("sync-error")).toHaveText("timeout", {
    timeout: 5000,
  });
});

test("a hostile config is ignored and pollutes nothing", async ({ page }) => {
  await api(page, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: FIXTURE.replace(
        '"version": 4,',
        '"version": 4, "__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}},',
      ).replaceAll(
        '"name": "Analytics"',
        '"name": "<img src=x onerror=alert(1)>"',
      ),
    }),
  );
  let dialog = false;
  page.on("dialog", () => {
    dialog = true;
  });
  await page.goto("/sync");
  await expect(section(page)).toHaveAttribute("data-cc-sync", "ready");
  await expect(section(page).locator("li")).toHaveText([
    "<img src=x onerror=alert(1)>",
    "Marketing",
  ]);
  await expect(section(page).locator("img")).toHaveCount(0);
  const polluted = await page.evaluate(
    () => (({}) as { polluted?: boolean }).polluted,
  );
  expect(polluted).toBeUndefined();
  const stored = await page.evaluate(() =>
    localStorage.getItem("cc_config:acctREDACTED:a1b2c3d4"),
  );
  expect(stored).toBeTruthy();
  expect(stored).not.toContain("__proto__");
  expect(stored).not.toContain("constructor");
  expect(dialog).toBe(false);
});

test("an unvalidated origin or secret key fails closed with no request", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1"))
      requests.push(request.url());
  });
  await page.goto(
    `/sync?base=${encodeURIComponent("http://evil.cookiechimp.test")}`,
  );
  await expect(section(page)).toHaveAttribute("data-cc-sync", "disabled");
  await page.goto("/sync?key=cc_sk_secret12345");
  await expect(section(page)).toHaveAttribute("data-cc-sync", "disabled");
  await expect(page.getByTestId("sync-error")).toHaveText(
    "secret keys must never be used in the browser",
  );
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
});
