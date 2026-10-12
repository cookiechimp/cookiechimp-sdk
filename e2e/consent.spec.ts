import { expect, test } from "@playwright/test";

test("acceptance persists after reload", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Analytics declined",
  );
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Analytics accepted",
  );
  const cookie = (await context.cookies()).find(
    ({ name }) => name === "cc_consent",
  );
  expect(cookie?.value).toMatch(/^v1\./);
  expect(cookie).toMatchObject({ path: "/", sameSite: "Lax", secure: false });
  expect((cookie?.expires ?? 0) - Date.now() / 1000).toBeGreaterThan(
    179 * 24 * 60 * 60,
  );
  const payload = JSON.parse(
    Buffer.from(cookie?.value.slice(3) ?? "", "base64url").toString(),
  );
  expect(payload).toMatchObject({
    schemaVersion: 1,
    consentId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
    ts: expect.any(String),
  });

  await page.reload();
  await expect(page.getByTestId("consent-status")).toHaveText(
    "Analytics accepted",
  );
});

test("a service decision persists after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("service-status")).toHaveText(
    "Analytics demo declined",
  );
  await page.getByRole("button", { name: "Toggle analytics demo" }).click();
  await expect(page.getByTestId("service-status")).toHaveText(
    "Analytics demo accepted",
  );
  await page.reload();
  await expect(page.getByTestId("service-status")).toHaveText(
    "Analytics demo accepted",
  );
});

test("gated script and frame activate with consent and after reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __ccAnalyticsRan?: boolean })
            .__ccAnalyticsRan,
      ),
    )
    .toBeUndefined();
  await expect(
    page.locator("iframe[title='Gated local frame']"),
  ).not.toHaveAttribute("src");
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __ccAnalyticsRan?: boolean })
            .__ccAnalyticsRan,
      ),
    )
    .toBe(true);
  await expect(
    page.locator("iframe[title='Gated local frame']"),
  ).toHaveAttribute("src", "/frame");
  await expect(
    page
      .frameLocator("iframe[title='Gated local frame']")
      .getByTestId("frame-content"),
  ).toBeVisible();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __ccAnalyticsRan?: boolean })
            .__ccAnalyticsRan,
      ),
    )
    .toBe(true);
  await expect(
    page.locator("iframe[title='Gated local frame']"),
  ).toHaveAttribute("src", "/frame");
});

test("dynamic iframe src set after insertion makes no request before consent", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://dynamic.cookiechimp.test/**", async (route) => {
    requests += 1;
    await route.abort();
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-dynamic",
    "ready",
  );
  await page.evaluate(() => {
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.src = "https://dynamic.cookiechimp.test/embed";
  });
  await page.waitForTimeout(100);
  expect(requests).toBe(0);
  await expect(page.locator("iframe[data-cc-blocked='true']")).toHaveAttribute(
    "data-cc-src",
    "https://dynamic.cookiechimp.test/embed",
  );
});

test("network requests start only after consent", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "dynamic.cookiechimp.test")
      requests.push(request.url());
  });
  await page.route("https://dynamic.cookiechimp.test/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-cc-network",
    "ready",
  );
  await page.getByRole("button", { name: "Send tracker requests" }).click();
  await page.waitForTimeout(100);
  expect(requests).toHaveLength(0);

  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await page.getByRole("button", { name: "Send tracker requests" }).click();
  await expect.poll(() => requests.length).toBe(3);
});
