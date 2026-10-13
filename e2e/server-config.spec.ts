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
