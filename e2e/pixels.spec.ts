import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { DynamicController } from "../packages/core/src/dynamic";
import type { ConsentRuntime } from "../packages/core/src/index";

declare global {
  interface Window {
    pixelTest: { consent: ConsentRuntime; controller: DynamicController };
  }
}

test("image requests wait for consent across detached, DOM and responsive images", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("https://pixels.vendor.test/**", async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      contentType: "image/gif",
      body: Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64",
      ),
    });
  });
  await page.route("http://pixels.cookiechimp.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/")
      return route.fulfill({
        contentType: "text/html",
        body: `<body><script type="module">
      import { createConsent } from '/index.mjs';
      import { blockDynamic } from '/dynamic.mjs';
      const config = { categories: ['analytics'], services: [{ id: 'pixels', category: 'analytics', domains: ['pixels.vendor.test'] }] };
      const consent = createConsent({ ...config, regulation: 'gdpr' });
      window.pixelTest = { consent, controller: blockDynamic(consent, { config }) };
    </script></body>`,
      });
    if (!/^\/[\w-]+\.mjs$/.test(path)) return route.abort();
    return route.fulfill({
      contentType: "text/javascript",
      body: await readFile(
        resolve(import.meta.dirname, "../packages/core/dist", path.slice(1)),
        "utf8",
      ),
    });
  });
  await page.goto("http://pixels.cookiechimp.test/");
  await page.waitForFunction(() => !!window.pixelTest);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => {
    const detached = new Image(1, 1);
    detached.src = "https://pixels.vendor.test/detached";
    const attribute = document.createElement("img");
    document.body.append(attribute);
    attribute.setAttribute("src", "https://pixels.vendor.test/attribute");
    const responsive = new Image();
    responsive.srcset =
      "https://pixels.vendor.test/responsive 1x, https://pixels.vendor.test/large 2x";
    document.body.append(responsive);
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.srcset = "https://pixels.vendor.test/picture 1x";
    picture.append(source, new Image());
    document.body.append(picture);
    const replaced = new Image();
    replaced.src = "https://pixels.vendor.test/stale";
    replaced.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    const removed = new Image();
    removed.src = "https://pixels.vendor.test/removed";
    removed.removeAttribute("src");
  });
  await expect(page.locator("[data-cc-blocked]")).toHaveCount(3);
  expect(requests).toEqual([]);
  await page.evaluate(() => window.pixelTest.consent.acceptAll());
  await expect.poll(() => requests.length).toBe(4);
  expect(requests.sort()).toEqual([
    "/attribute",
    "/detached",
    "/picture",
    "/responsive",
  ]);
  await page.evaluate(() => {
    window.pixelTest.consent.rejectAll();
    new Image().src = "https://pixels.vendor.test/withdrawn";
  });
  expect(
    await page.evaluate(() => window.pixelTest.controller.blocked().at(-1)),
  ).toMatchObject({
    kind: "image",
    url: "https://pixels.vendor.test/withdrawn",
  });
  // A same-origin fetch is a browser event-loop/network round trip after denial.
  await page.evaluate(() => fetch("/").then((r) => r.text()));
  expect(requests).toHaveLength(4);
  await page.evaluate(() => window.pixelTest.consent.acceptAll());
  await expect.poll(() => requests.length).toBe(5);
  expect(requests.at(-1)).toBe("/withdrawn");
  expect(errors).toEqual([]);
});
