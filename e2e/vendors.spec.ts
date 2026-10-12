import { expect, type Page, test } from "@playwright/test";

const vendorHosts = [
  "facebook.net",
  "facebook.com",
  "clarity.ms",
  "posthog.com",
  "segment.com",
  "segment.io",
  "hotjar.com",
  "hotjar.io",
  "licdn.com",
  "linkedin.com",
  "tiktok.com",
];

async function recordVendorRequests(page: Page) {
  const urls: string[] = [];
  const record = async (route: Parameters<Parameters<Page["route"]>[1]>[0]) => {
    urls.push(route.request().url());
    await route.fulfill({ contentType: "application/javascript", body: "" });
  };
  for (const host of vendorHosts) {
    await page.route(`**/*.${host}/**`, record);
    await page.route(`**://${host}/**`, record);
  }
  return urls;
}

async function ready(page: Page) {
  await page.goto("/vendors");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-vendors",
    "ready",
  );
}

test("no vendor request leaves the page before consent, even after network idle", async ({
  page,
}) => {
  const urls = await recordVendorRequests(page);
  await ready(page);
  await page.waitForLoadState("networkidle");
  expect(urls).toEqual([]);
  const sources = await page.evaluate(() =>
    [...document.querySelectorAll("script")]
      .map((node) => node.getAttribute("src") ?? "")
      .filter((src) =>
        /facebook|clarity|posthog|segment|hotjar|licdn|tiktok/.test(src),
      ),
  );
  expect(sources).toEqual([]);
  const queued = await page.evaluate(() => {
    const host = window as unknown as Record<string, unknown>;
    return [
      "fbq",
      "clarity",
      "posthog",
      "analytics",
      "hj",
      "lintrk",
      "ttq",
    ].every((name) => host[name] !== undefined);
  });
  expect(queued).toBe(true);
});

test("vendors load only for their granted category", async ({ page }) => {
  const urls = await recordVendorRequests(page);
  await ready(page);
  await page.getByRole("button", { name: "Accept analytics only" }).click();
  for (const part of [
    "clarity.ms/tag/ccfixture1",
    "us-assets.i.posthog.com/static/array.js",
    "cdn.segment.com/analytics.js/v1/CookieChimpFixture0123456789abcd/",
    "static.hotjar.com/c/hotjar-1234567.js",
  ])
    await expect.poll(() => urls.some((url) => url.includes(part))).toBe(true);
  await page.waitForLoadState("networkidle");
  expect(urls.some((url) => /facebook|licdn|linkedin|tiktok/.test(url))).toBe(
    false,
  );

  await page.getByRole("button", { name: "Accept all vendors" }).click();
  for (const part of [
    "connect.facebook.net/en_US/fbevents.js",
    "snap.licdn.com/li.lms-analytics/insight.min.js",
    "analytics.tiktok.com/i18n/pixel/events.js?sdkid=CCFIXTURE01234567890",
  ])
    await expect.poll(() => urls.some((url) => url.includes(part))).toBe(true);
});

test("revoking after load calls the loaded vendor consent APIs", async ({
  page,
}) => {
  // Each loader body replaces the stub with a recording "library", as the
  // real vendor scripts replace their queue stubs when they load.
  const bodies: Record<string, string> = {
    "fbevents.js":
      "window.__fbq=[];window.fbq=function(){window.__fbq.push([].slice.call(arguments))};",
    "clarity.ms/tag/":
      "window.__clarity=[];window.clarity=function(){window.__clarity.push([].slice.call(arguments))};",
    "events.js?sdkid=":
      "window.__ttq=[];window.ttq={grantConsent:function(){window.__ttq.push('grant')},revokeConsent:function(){window.__ttq.push('revoke')}};",
  };
  for (const host of vendorHosts) {
    const handler = async (
      route: Parameters<Parameters<Page["route"]>[1]>[0],
    ) => {
      const url = route.request().url();
      const key = Object.keys(bodies).find((part) => url.includes(part));
      await route.fulfill({
        contentType: "application/javascript",
        body: key ? bodies[key] : "",
      });
    };
    await page.route(`**/*.${host}/**`, handler);
    await page.route(`**://${host}/**`, handler);
  }
  await ready(page);
  await page.getByRole("button", { name: "Accept all vendors" }).click();
  const loaded = () =>
    page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return Boolean(w.__fbq && w.__clarity && w.__ttq);
    });
  await expect.poll(loaded).toBe(true);
  await page.getByRole("button", { name: "Revoke vendors" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const w = window as unknown as Record<string, unknown[]>;
        return { fbq: w.__fbq, clarity: w.__clarity, ttq: w.__ttq };
      }),
    )
    .toEqual({
      fbq: [["consent", "revoke"]],
      clarity: [["consent", false]],
      ttq: ["revoke"],
    });
});
