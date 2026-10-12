import { describe, expect, it } from "vitest";
import {
  ConsentConfigError,
  categoriesHash,
  matchService,
  mergeConfig,
  normalizeConfig,
} from "./index";

describe("normalizeConfig", () => {
  it("normalizes every category shorthand identically", () => {
    const forms = [
      ["analytics"],
      { analytics: false },
      [{ name: "analytics", default: false }],
      [{ id: "analytics", default: false }],
    ];
    const outputs = forms.map((categories) => normalizeConfig({ categories }));
    expect(outputs.slice(1)).toEqual([outputs[0], outputs[0], outputs[0]]);
    expect(outputs[0]?.categories[0]).toEqual({
      id: "necessary",
      required: true,
      locked: true,
      default: true,
    });
    expect(Object.isFrozen(outputs[0])).toBe(true);
    expect(Object.isFrozen(outputs[0]?.categories)).toBe(true);
  });

  it("reports all configuration problems with a typed stable error", () => {
    expect(() =>
      normalizeConfig({
        categories: [{ id: "Bad id" }, { id: "dup" }, { id: "dup" }],
        services: [
          { id: "Bad Service", category: "missing", scripts: ["bad pattern"] },
          { id: "same", category: "necessary", cookies: [""] },
          { id: "same", category: "necessary" },
        ],
      }),
    ).toThrowError(
      new ConsentConfigError([
        'category id "Bad id" is invalid',
        'duplicate category id "dup"',
        'service id "Bad Service" is invalid',
        'service "Bad Service" references unknown category "missing"',
        'service "Bad Service" has invalid scripts pattern',
        'service "same" has invalid cookies pattern',
        'duplicate service id "same"',
      ]),
    );
  });

  it("always locks and enables necessary", () => {
    expect(
      normalizeConfig({ categories: { necessary: false } }).categories[0],
    ).toEqual({
      id: "necessary",
      required: true,
      locked: true,
      default: true,
    });
  });
});

describe("config utilities", () => {
  it("merges records by id with override, dashboard, defaults precedence", () => {
    const merged = mergeConfig(
      {
        categories: [{ id: "analytics", label: "Default" }],
        services: [{ id: "ga", category: "analytics", name: "Default" }],
      },
      {
        categories: [{ id: "analytics", label: "Dashboard", default: true }],
        services: [{ id: "ga", category: "analytics", name: "Dashboard" }],
      },
      {
        categories: [{ id: "analytics", label: "Override" }],
        services: [{ id: "ga", category: "analytics", name: "Override" }],
      },
    );
    expect(merged.categories[1]).toMatchObject({
      label: "Override",
      default: true,
    });
    expect(merged.services[0]).toMatchObject({ name: "Override" });
  });

  it("hashes categories deterministically without depending on order", () => {
    const a = { categories: ["analytics", "ads"] };
    const b = { categories: ["ads", "analytics"] };
    expect(categoriesHash(a)).toBe(categoriesHash(a));
    expect(categoriesHash(a)).toBe(categoriesHash(b));
    expect(categoriesHash(a)).not.toBe(
      categoriesHash({ categories: [...a.categories, "video"] }),
    );
    expect(categoriesHash(a)).toMatch(/^[a-z0-9]{7}$/);
  });

  it("matches script wildcards and regexes, cookie names and hosts", () => {
    const config = normalizeConfig({
      categories: ["analytics"],
      services: [
        {
          id: "analytics-demo",
          category: "analytics",
          scripts: ["https://cdn.example/*", /tracker\d+\.js$/],
          cookies: ["_ga*"],
          domains: ["*.metrics.example"],
        },
      ],
    });
    expect(matchService(config, { url: "https://cdn.example/a.js" })).toBe(
      "analytics-demo",
    );
    expect(matchService(config, { url: "https://other/tracker12.js" })).toBe(
      "analytics-demo",
    );
    expect(matchService(config, { cookieName: "_ga_123" })).toBe(
      "analytics-demo",
    );
    expect(matchService(config, { host: "api.metrics.example" })).toBe(
      "analytics-demo",
    );
    expect(matchService(config, { host: "example.org" })).toBeNull();
  });
});
