import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("SSR HTML already carries the dashboard copy before any JavaScript runs", async ({
  request,
}) => {
  const response = await request.get("/connected");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("Wir respektieren Ihre Privatsphäre");
  expect(html).toContain("Alle akzeptieren");
  // Dashboard categories and the code-only category are both in the markup.
  for (const id of ["local-only", "analytics", "marketing"])
    expect(html).toContain(`data-category="${id}"`);
});

test.describe("German browser", () => {
  test.use({ locale: "de-DE" });
  test("hydrates the connected page without a mismatch and keeps the dashboard copy", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const platform: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/mobile-sdk/"))
        platform.push(request.url());
    });
    await page.goto("/connected");
    await expect(page.getByTestId("banner-title")).toHaveText(
      "Wir respektieren Ihre Privatsphäre",
    );
    await expect(
      page.getByRole("button", { name: "Alle akzeptieren" }),
    ).toBeVisible();
    expect(errors.filter((text) => /hydrat|mismatch/i.test(text))).toEqual([]);
    // The config came from the server; the browser made no platform request.
    expect(platform).toEqual([]);
  });
});

test("an English visitor gets the dashboard's English copy, not the code defaults", async ({
  request,
}) => {
  const html = await (
    await request.get("/connected", { headers: { "accept-language": "en-US" } })
  ).text();
  // The outer layout banner keeps its own code copy; check the fixture heading.
  expect(html).toContain('data-testid="banner-title">We value your privacy<');
});

test("an unknown account renders the code config", async ({ request }) => {
  const html = await (
    await request.get("/connected?project=acctMissing")
  ).text();
  expect(html).not.toContain("Wir respektieren Ihre Privatsphäre");
  expect(html).toContain('data-category="local-only"');
});

test("production refuses a plain-http platform origin and renders the code config", async ({
  request,
}) => {
  const response = await request.get("/connected-guard");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("Connected guard fixture");
  expect(html).not.toContain("Wir respektieren");
});

test("the server-only fetch prop never reaches the HTML or the RSC payload", async ({
  request,
}) => {
  const html = await (await request.get("/connected")).text();
  const rsc = await (
    await request.get("/connected", { headers: { RSC: "1" } })
  ).text();
  // Real payloads, not error pages: both carry the server-rendered copy.
  expect(html).toContain("Alle akzeptieren");
  expect(rsc).toContain("Alle akzeptieren");
  for (const payload of [html, rsc]) {
    expect(payload).not.toContain("server-only-transport-7f3a9c");
    expect(payload).not.toContain('"fetch"');
  }
});

test("consent is stored under the dashboard cookie name with its expiry", async ({
  page,
  context,
}) => {
  await page.goto("/connected");
  await page
    .getByRole("button", { name: /Alle akzeptieren|Accept All/ })
    .click();
  await expect
    .poll(async () =>
      (await context.cookies()).some(
        ({ name }) => name === "cookiechimp_pref_REDACTED",
      ),
    )
    .toBe(true);
  const cookie = (await context.cookies()).find(
    ({ name }) => name === "cookiechimp_pref_REDACTED",
  );
  const days = ((cookie?.expires ?? 0) - Date.now() / 1000) / 86400;
  expect(days).toBeGreaterThan(181);
  expect(days).toBeLessThanOrEqual(182);
  // A returning visit reads consent back under the same name on the server.
  const html = await (await page.request.get("/connected")).text();
  expect(html).toContain(
    'data-category="analytics">analytics<!-- -->: <!-- -->on',
  );
});

test("the browser revalidates after hydration and shows newer dashboard copy", async ({
  page,
}) => {
  const bundle = JSON.parse(
    readFileSync(
      resolve("packages/core/src/fixtures/platform-offline-bundle.json"),
      "utf8",
    ),
  );
  bundle.cache_version = "live";
  bundle.translations.bnrUS1.en.consent_modal.title =
    "Fresh from the dashboard";
  const calls: Record<string, string>[] = [];
  await page.route(
    "https://api.cookiechimp.test/api/v1/mobile-sdk/offline/acctREDACTED",
    async (route) => {
      calls.push(route.request().headers());
      await route.fulfill({
        json: bundle,
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );
  await page.goto("/connected-live");
  await expect(page.getByTestId("banner-title")).toHaveText(
    "Fresh from the dashboard",
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]?.cookie).toBeUndefined();
});
