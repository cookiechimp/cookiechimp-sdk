import { expect, test } from "@playwright/test";

const fixture = {
  vendorListVersion: 180,
  tcfPolicyVersion: 5,
  standardTexts: { features: "Fixture explanation supplied by the GVL." },
  purposes: {
    "1": {
      name: "Fixture purpose",
      description: "Purpose description supplied by the GVL.",
      illustrations: ["Purpose example supplied by the GVL."],
    },
  },
  specialFeatures: {
    "2": {
      name: "Identify devices based on information actively requested",
      description: "Special feature description supplied by the GVL.",
      illustrations: ["Special feature example supplied by the GVL."],
    },
  },
  features: {
    "1": {
      name: "Fixture ordinary feature",
      description: "Ordinary feature description supplied by the GVL.",
      illustrations: ["Ordinary feature example supplied by the GVL."],
    },
  },
  vendors: {
    "1": {
      id: 1,
      name: "Disclosure fixture vendor",
      purposes: [1],
      legIntPurposes: [],
      specialFeatures: [2],
      features: [1],
    },
  },
};
for (const mobile of [false, true]) {
  test(`TCF v2.4 GVL disclosures render safely and work with the keyboard (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const payload = structuredClone(fixture);
    if (mobile)
      payload.features["1"].illustrations.push(
        '<img src=x onerror="alert(1)">',
      );
    await page.route("**/tcf/gvl?large", (route) =>
      route.fulfill({ json: payload }),
    );
    await page.goto("/tcf-vendors");
    await expect(page.locator("html")).toHaveAttribute("data-cc-tcf", "ready");
    await page.getByRole("button", { name: "Manage vendors" }).click();
    const purpose = page
      .locator("summary")
      .filter({ hasText: "Fixture purpose" });
    await purpose.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Purpose description supplied by the GVL.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Purpose example supplied by the GVL.", { exact: true }),
    ).toBeVisible();
    const special = page.getByRole("checkbox", {
      name: fixture.specialFeatures["2"].name,
      exact: true,
    });
    await special.check();
    await expect(special).toBeChecked();
    await page
      .getByRole("button", {
        name: "Details: Disclosure fixture vendor",
        exact: true,
      })
      .click();
    const panel = page.getByRole("region", {
      name: "Disclosure fixture vendor",
      exact: true,
    });
    await expect(
      panel.getByText(fixture.standardTexts.features, { exact: true }),
    ).toBeVisible();
    const feature = panel
      .locator("summary")
      .filter({ hasText: "Fixture ordinary feature" });
    await feature.focus();
    await page.keyboard.press("Enter");
    await expect(
      panel.getByText(fixture.features["1"].description, { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByText(fixture.features["1"].illustrations[0] as string, {
        exact: true,
      }),
    ).toBeVisible();
    const ordinary = panel
      .locator(".cc-tcf__detail")
      .filter({
        has: page.getByRole("heading", { name: "Features", exact: true }),
      })
      .first();
    await expect(ordinary).toHaveCount(1);
    await expect(ordinary.locator("input")).toHaveCount(0);
    await expect(panel.locator("img, [onerror]")).toHaveCount(0);
    if (mobile) {
      await expect(
        panel.getByText('<img src=x onerror="alert(1)">', { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (mobile)
      await page.screenshot({
        path: "test-results/tcf-disclosures-mobile.png",
        fullPage: true,
      });
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    expect(errors).toEqual([]);
  });
}
