import { expect, test } from "@playwright/test";

const site = "http://127.0.0.1:3103";
test("search finds real section links, preserves the query and sends no external requests", async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(site)) external.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(site);
  await page.getByRole("link", { name: "Search docs", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "Search docs" });
  await expect(input).toBeEnabled();
  await input.fill("TcfProvider");
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("link").first()).toHaveAttribute(
    "href",
    "reference.html#opt-in-react-tcf-provider",
  );
  await page.reload();
  await expect(input).toHaveValue("TcfProvider");
  await expect(results.getByRole("link").first()).toBeVisible();
  await results.getByRole("link").first().click();
  await expect(page).toHaveURL(
    `${site}/reference.html#opt-in-react-tcf-provider`,
  );
  await expect(page.locator("#opt-in-react-tcf-provider")).toBeInViewport();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("search works on mobile with keyboard submit, empty results and a safe rendered index", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/search-index.json", (route) =>
    route.fulfill({
      json: [
        {
          title: "<img src=x onerror=alert(1)> Safe result",
          text: "Safe needle",
          url: "reference.html#opt-in-react-tcf-provider",
        },
        { title: "Unsafe", text: "needle", url: "javascript:alert(1)" },
      ],
    }),
  );
  await page.goto(`${site}/search.html`);
  const input = page.getByRole("searchbox", { name: "Search docs" });
  await expect(input).toBeEnabled();
  await input.fill("needle");
  await input.press("Enter");
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("link")).toHaveCount(1);
  await expect(results.getByRole("link")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(results.locator("img")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/docs-search-mobile.png",
    fullPage: true,
  });
  await input.fill("unmatched");
  await expect(page.getByRole("status")).toContainText("No matching sections");
  await input.fill("");
  await expect(page.getByRole("status")).toContainText("Enter a word");
});
test("a failed index provides a browse fallback; no-JS users can still read all docs", async ({
  page,
  browser,
}) => {
  await page.route("**/search-index.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto(`${site}/search.html`);
  await expect(page.getByRole("status")).toContainText("Search could not load");
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const plain = await context.newPage();
    await plain.goto(`${site}/search.html`);
    await expect(
      plain.getByRole("searchbox", { name: "Search docs" }),
    ).toBeDisabled();
    await plain
      .getByRole("link", { name: "Read the full docs", exact: true })
      .click();
    await expect(plain.locator("body")).toContainText(
      "CookieChimp Consent SDK",
    );
  } finally {
    await context.close();
  }
});
