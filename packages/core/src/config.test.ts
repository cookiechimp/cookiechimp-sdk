import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentConfigError, normalizeConfig } from "./index";

const originalEnvironment = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnvironment;
  vi.restoreAllMocks();
});

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

  it("warns once and drops invalid entries in production", () => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const config = normalizeConfig({
      categories: ["analytics", "analytics", "Bad id"],
      services: [
        { id: "ga", category: "analytics" },
        { id: "ga", category: "analytics" },
        { id: "unknown", category: "missing" },
        { id: "Bad Service", category: "analytics" },
      ],
    });
    expect(config.categories.map(({ id }) => id)).toEqual([
      "necessary",
      "analytics",
    ]);
    expect(config.services.map(({ id }) => id)).toEqual(["ga"]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
