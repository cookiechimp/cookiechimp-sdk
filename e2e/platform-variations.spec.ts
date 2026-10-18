import { expect, test } from "@playwright/test";

test("platform banner positions and button variations match their JSON options", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3104/platform.html?preview=1");
  const banner = page.locator(".cc-platform-banner");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing viewport");
  for (const vertical of ["top", "middle", "bottom"])
    for (const horizontal of ["left", "center", "right"]) {
      await page
        .getByRole("combobox", { name: "Banner position", exact: true })
        .selectOption(`${vertical} ${horizontal}`);
      await expect(banner).toHaveAttribute(
        "data-cc-position",
        `${vertical === "middle" ? "center" : vertical} ${horizontal}`,
      );
      const box = await banner.boundingBox();
      if (!box) throw new Error("Missing banner");
      const expectedX =
        horizontal === "left"
          ? 16
          : horizontal === "right"
            ? viewport.width - box.width - 16
            : (viewport.width - box.width) / 2;
      const expectedY =
        vertical === "top"
          ? 16
          : vertical === "bottom"
            ? viewport.height - box.height - 16
            : (viewport.height - box.height) / 2;
      expect(box.x).toBeCloseTo(expectedX, 0);
      expect(box.y).toBeCloseTo(expectedY, 0);
    }
  for (const placement of ["stacked", "inline", "wide"]) {
    await page
      .getByRole("combobox", { name: "Button placement", exact: true })
      .selectOption(placement);
    await expect(banner.locator(".cc-actions")).toHaveCSS(
      "display",
      placement === "inline" ? "grid" : "flex",
    );
  }
  await page
    .getByRole("combobox", { name: "Banner position", exact: true })
    .selectOption("top right");
  await page
    .getByRole("checkbox", { name: "Swap banner buttons", exact: true })
    .check({ force: true });
  await expect(banner.locator(".cc-actions button")).toHaveText([
    "Manage Preferences",
    "Reject All",
    "Accept All",
  ]);
  for (const layout of ["cloud", "bar"]) {
    await page
      .getByRole("combobox", { name: "Banner layout", exact: true })
      .selectOption(layout);
    await expect(banner).toHaveAttribute("data-cc-layout", layout);
    await expect(banner).toHaveCSS("flex-direction", "row");
  }
  await page
    .getByRole("combobox", { name: "Banner position", exact: true })
    .selectOption("top center");
  const bar = await banner.boundingBox();
  expect(bar?.x).toBe(0);
  expect(bar?.y).toBe(0);
  expect(bar?.width).toBe(viewport.width);
});

test("platform auto theme, unit radii and both full-height side panels work", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3104/platform.html?preview=1");
  await page
    .getByRole("combobox", { name: "Color scheme", exact: true })
    .selectOption("auto");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".cc-platform-banner")).toHaveCSS(
    "background-color",
    "rgb(23, 26, 28)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".cc-platform-banner")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page
    .getByRole("combobox", { name: "Corner radius", exact: true })
    .selectOption("1rem");
  await expect(page.locator(".cc-platform-banner")).toHaveCSS(
    "border-radius",
    "16px",
  );
  for (const position of ["left", "right"]) {
    await page
      .getByRole("combobox", { name: "Preferences layout", exact: true })
      .selectOption(`bar ${position}`);
    await page
      .getByRole("button", { name: "Manage cookie preferences", exact: true })
      .click();
    const panel = page.locator(
      ".cc-platform-preferences .cc-preferences__panel",
    );
    await expect(panel).toHaveCSS("height", `${page.viewportSize()?.height}px`);
    await expect(panel).toHaveCSS("translate", "none");
    const bounds = await panel.boundingBox();
    expect(bounds?.y).toBe(0);
    if (position === "left") expect(bounds?.x).toBe(0);
    else
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBe(
        page.viewportSize()?.width,
      );
    await page
      .getByRole("dialog", { name: "Cookie Settings" })
      .getByRole("button", { name: "Close", exact: true })
      .click();
  }
});

test("platform layouts stay inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3104/platform.html?preview=1");
  for (const layout of ["box", "cloud", "bar"]) {
    await page
      .getByRole("combobox", { name: "Banner layout", exact: true })
      .selectOption(layout);
    const bounds = await page.locator(".cc-platform-banner").boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    expect(bounds?.height).toBeLessThanOrEqual(844);
  }
});

for (const width of [1280, 390, 320]) {
  test(`preferences keep save separate and accept/reject paired at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const panel of ["box", "bar left", "bar right"]) {
      for (const locale of ["en", "ar"]) {
        const options = encodeURIComponent(
          JSON.stringify({ panel, locale, view: "preferences" }),
        );
        await page.goto(
          `http://127.0.0.1:3104/platform.html?preview=1&fresh=1&options=${options}`,
        );
        const dialog = page.locator(".cc-platform-preferences");
        const save = dialog.locator('[data-cc-part="preferences-save"]');
        const reject = dialog.locator(
          '[data-cc-part="preferences-reject-all"]',
        );
        const accept = dialog.locator(
          '[data-cc-part="preferences-accept-all"]',
        );
        await expect(save).toBeVisible();
        // Bring the sticky footer into view before measuring its final layout.
        await save.scrollIntoViewIfNeeded();
        await expect(dialog.locator(".cc-preferences__panel")).toHaveCSS(
          "translate",
          "none",
        );
        const bounds = await Promise.all(
          [save, reject, accept].map((button) => button.boundingBox()),
        );
        const [s, r, a] = bounds;
        if (!s || !r || !a) throw new Error("Missing preferences action");
        expect(r.y).toBeCloseTo(a.y, 0);
        expect(r.height).toBeCloseTo(a.height, 0);
        for (const box of [s, r, a]) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
        if (width <= 640) {
          expect(s.y + s.height).toBeLessThanOrEqual(r.y);
        } else if (locale === "ar") {
          expect(s.x).toBeGreaterThan(a.x + a.width);
        } else {
          expect(s.x + s.width).toBeLessThan(r.x);
        }
      }
    }
  });
}
