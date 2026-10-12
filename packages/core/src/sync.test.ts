import { describe, expect, it } from "vitest";
import { categoriesHash, mergeConfig } from "./sync";

describe("mergeConfig", () => {
  it("merges categories by id with override, dashboard, defaults precedence", () => {
    const merged = mergeConfig(
      {
        categories: [
          { id: "analytics", label: "Default analytics", default: false },
          { id: "preferences", label: "Default preferences" },
        ],
      },
      {
        categories: [
          { id: "analytics", label: "Dashboard analytics", default: true },
          { id: "ads", label: "Dashboard ads" },
        ],
      },
      {
        categories: [{ id: "analytics", label: "Override analytics" }],
      },
    );

    expect(merged.categories).toEqual([
      { id: "necessary", required: true, locked: true, default: true },
      {
        id: "analytics",
        required: false,
        locked: false,
        default: true,
        label: "Override analytics",
      },
      {
        id: "preferences",
        required: false,
        locked: false,
        default: false,
        label: "Default preferences",
      },
      {
        id: "ads",
        required: false,
        locked: false,
        default: false,
        label: "Dashboard ads",
      },
    ]);
  });

  it("merges services by id and preserves fields omitted by partial layers", () => {
    const merged = mergeConfig(
      {
        categories: ["analytics", "ads"],
        services: [
          {
            id: "metrics",
            category: "analytics",
            name: "Default name",
            scripts: ["default.example/*"],
          },
        ],
      },
      {
        services: [
          { id: "metrics", category: "analytics", name: "Dashboard name" },
          { id: "ads-service", category: "ads", domains: ["ads.example"] },
        ],
      },
      {
        services: [{ id: "metrics", category: "ads", default: true }],
      },
    );

    expect(merged.services).toEqual([
      {
        id: "metrics",
        category: "ads",
        name: "Dashboard name",
        scripts: ["default.example/*"],
        cookies: [],
        domains: [],
        default: true,
      },
      {
        id: "ads-service",
        category: "ads",
        scripts: [],
        cookies: [],
        domains: ["ads.example"],
        default: false,
      },
    ]);
  });

  it("supports every missing optional layer", () => {
    const defaults = {
      categories: [{ id: "analytics", label: "Local" }],
      services: [{ id: "metrics", category: "analytics" }],
    } as const;
    expect(mergeConfig(defaults)).toMatchObject({
      categories: [{ id: "necessary" }, { id: "analytics", label: "Local" }],
      services: [{ id: "metrics", category: "analytics" }],
    });
    expect(mergeConfig(defaults, undefined, {})).toEqual(mergeConfig(defaults));
    expect(mergeConfig({}, { categories: ["ads"] }).categories[1]?.id).toBe(
      "ads",
    );
  });
});

describe("categoriesHash", () => {
  const base = {
    categories: [
      { id: "analytics", label: "Analytics" },
      { id: "ads", label: "Advertising" },
    ],
  } as const;

  it("is deterministic and independent of declaration order", () => {
    expect(categoriesHash(base)).toBe(categoriesHash(base));
    expect(categoriesHash(base)).toBe(
      categoriesHash({ categories: [...base.categories].reverse() }),
    );
    expect(categoriesHash(base)).toMatch(/^[a-z0-9]{7}$/);
  });

  it("changes when a category is added, removed, or renamed", () => {
    const hash = categoriesHash(base);
    expect(
      categoriesHash({ categories: [...base.categories, "preferences"] }),
    ).not.toBe(hash);
    expect(categoriesHash({ categories: [base.categories[0]] })).not.toBe(hash);
    expect(
      categoriesHash({
        categories: [
          { id: "analytics", label: "Measurement" },
          base.categories[1],
        ],
      }),
    ).not.toBe(hash);
  });
});
