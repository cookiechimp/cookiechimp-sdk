import { expect, type Page, test } from "@playwright/test";

const googleHosts = [
  "googletagmanager.com",
  "google-analytics.com",
  "googleadservices.com",
  "doubleclick.net",
];

async function recordGoogleRequests(page: Page) {
  const urls: string[] = [];
  for (const host of googleHosts) {
    await page.route(`**/*.${host}/**`, async (route) => {
      urls.push(route.request().url());
      await route.fulfill({ contentType: "application/javascript", body: "" });
    });
    await page.route(`**://${host}/**`, async (route) => {
      urls.push(route.request().url());
      await route.fulfill({ contentType: "application/javascript", body: "" });
    });
  }
  return urls;
}

const dataLayer = (page: Page) =>
  page.evaluate(() =>
    (
      window as typeof window & { dataLayer: ArrayLike<unknown>[] }
    ).dataLayer.map((entry) => Array.from(entry)),
  );

test("basic presets gate Google requests and update Consent Mode signals", async ({
  page,
}) => {
  const urls = await recordGoogleRequests(page);
  await page.goto("/presets");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-presets",
    "ready",
  );
  expect(urls).toEqual([]);

  const early = await dataLayer(page);
  expect(
    early.some(
      (entry) => entry[0] === "event" && entry[1] === "preset_early_call",
    ),
  ).toBe(true);
  const defaultIndex = early.findIndex(
    (entry) => entry[0] === "consent" && entry[1] === "default",
  );
  expect(defaultIndex).toBeGreaterThanOrEqual(0);
  expect(early[defaultIndex]?.[2]).toMatchObject({
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  expect(
    early.findIndex((entry) => entry[0] === "consent" && entry[1] === "update"),
  ).toBe(-1);

  await page.getByRole("button", { name: "Accept analytics only" }).click();
  await expect
    .poll(() => urls.some((url) => url.includes("gtag/js?id=G-COOKIECHIMP")))
    .toBe(true);
  expect(urls.some((url) => url.includes("gtag/js?id=AW-"))).toBe(false);
  expect(urls.some((url) => url.includes("gtm.js?id=GTM-COOKIECHIMP"))).toBe(
    true,
  );
  const analyticsLayer = await dataLayer(page);
  const analyticsUpdate = analyticsLayer.find(
    (entry) =>
      entry[0] === "consent" &&
      entry[1] === "update" &&
      (entry[2] as { analytics_storage?: string }).analytics_storage ===
        "granted",
  );
  expect(analyticsUpdate?.[2]).toMatchObject({
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  expect(analyticsLayer.indexOf(analyticsUpdate ?? [])).toBeGreaterThan(
    defaultIndex,
  );

  await page.getByRole("button", { name: "Accept all presets" }).click();
  await expect
    .poll(() => urls.some((url) => url.includes("gtag/js?id=AW-COOKIECHIMP")))
    .toBe(true);
  const allLayer = await dataLayer(page);
  expect(
    allLayer.some(
      (entry) =>
        entry[0] === "consent" &&
        entry[1] === "update" &&
        (entry[2] as Record<string, string>).ad_storage === "granted" &&
        (entry[2] as Record<string, string>).ad_user_data === "granted" &&
        (entry[2] as Record<string, string>).ad_personalization === "granted",
    ),
  ).toBe(true);
});

test("advanced GTM loads only after denied defaults are queued", async ({
  page,
}) => {
  let layerAtGtmRequest: unknown[][] = [];
  await page.route("**://www.googletagmanager.com/**", async (route) => {
    if (route.request().url().includes("gtm.js"))
      layerAtGtmRequest = await dataLayer(page);
    await route.fulfill({ contentType: "application/javascript", body: "" });
  });
  await page.goto("/presets?gtm=advanced");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-presets",
    "ready",
  );
  await expect.poll(() => layerAtGtmRequest.length).toBeGreaterThan(0);
  const defaultEntry = layerAtGtmRequest.find(
    (entry) => entry[0] === "consent" && entry[1] === "default",
  );
  expect(defaultEntry?.[2]).toMatchObject({
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
});
