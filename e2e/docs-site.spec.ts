import { expect, test } from "@playwright/test";
import { pages as pageSpecs } from "../packages/docs/src/pages";

const site = "http://127.0.0.1:3103";

test("docs site renders pages with working nav and no console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${site}/`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "CookieChimp Consent SDK",
  );
  const nav = page.getByRole("navigation", { name: "Docs" });
  await nav.getByRole("link", { name: "Getting started" }).click();
  await expect(page).toHaveURL(`${site}/getting-started.html`);
  await expect(
    nav.getByRole("link", { name: "Getting started" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator("pre code").first()).toContainText(
    "@cookiechimp/cli init",
  );
  await page
    .getByRole("link", { name: "Next.js", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "CookieChimp for Next.js",
  );
  expect(errors).toEqual([]);
});

test("every nav page and in-site link resolves", async ({ page, request }) => {
  await page.goto(`${site}/`);
  const pages = await page
    .getByRole("navigation", { name: "Docs" })
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
  expect(pages.length).toBe(pageSpecs.length);
  const checked = new Set<string>();
  for (const href of pages) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    await page.goto(href);
    const local = await page
      .locator("main a[href]")
      .evaluateAll((links) =>
        links
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => h.startsWith("http://127.0.0.1:3103/")),
      );
    for (const link of local) {
      const target = link.split("#")[0] as string;
      if (checked.has(target)) continue;
      checked.add(target);
      expect((await request.get(target)).status(), `${href} -> ${link}`).toBe(
        200,
      );
    }
  }
});

test("llms.txt, llms-full.txt, markdown pages and skills are served", async ({
  request,
}) => {
  const llms = await request.get(`${site}/llms.txt`);
  expect(llms.headers()["content-type"]).toContain("text/plain");
  const text = await llms.text();
  expect(text.startsWith("# CookieChimp Consent SDK")).toBe(true);
  for (const [, path] of text.matchAll(/\]\((\/[^)]+)\)/g)) {
    expect((await request.get(`${site}${path}`)).status(), path).toBe(200);
  }
  const full = await (await request.get(`${site}/llms-full.txt`)).text();
  expect(full).toContain("<!-- page: nextjs ");
  const skill = await request.get(`${site}/skills/install-banner/SKILL.md`);
  expect(await skill.text()).toContain("name: install-banner");
});

test("strict CSP: the page loads only its own stylesheet", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(site)) external.push(r.url());
  });
  await page.goto(`${site}/reference.html`);
  await expect(page.locator("link[rel=stylesheet]")).toHaveAttribute(
    "href",
    "style.css",
  );
  const color = await page
    .locator("nav")
    .evaluate((el) => getComputedStyle(el).borderRightStyle);
  expect(color).toBe("solid");
  expect(external).toEqual([]);
});
