import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentConfigError, createConsent, normalizeConfig } from "./index";

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

  it.each([
    ["normalizeConfig", normalizeConfig],
    ["createConsent", createConsent],
  ])(
    "reports all configuration problems from %s in one typed stable error",
    (_name, configure) => {
      process.env.NODE_ENV = "development";
      const run = () =>
        configure({
          categories: [{ id: "Bad id" }, { id: "dup" }, { id: "dup" }],
          services: [
            {
              id: "Bad Service",
              category: "missing",
              scripts: ["bad pattern"],
            },
            { id: "same", category: "necessary", cookies: [""] },
            { id: "same", category: "necessary" },
          ],
        });
      expect(run).toThrowError(ConsentConfigError);
      try {
        run();
      } catch (error) {
        expect(error).toEqual(
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
        expect((error as ConsentConfigError).problems).toHaveLength(7);
      }
    },
  );

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

  it("warns exactly once per call, keeps first duplicates, and drops every invalid entry in production", () => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const config = normalizeConfig({
      categories: [
        { id: "analytics", label: "first" },
        { id: "analytics", label: "second" },
        "Bad id",
      ],
      services: [
        { id: "ga", category: "analytics", name: "first" },
        { id: "ga", category: "analytics", name: "second" },
        { id: "unknown", category: "missing" },
        { id: "Bad Service", category: "analytics" },
        { id: "bad-pattern", category: "analytics", domains: ["bad host"] },
      ],
    });
    expect(config.categories.map(({ id }) => id)).toEqual([
      "necessary",
      "analytics",
    ]);
    expect(config.services.map(({ id }) => id)).toEqual(["ga"]);
    expect(config.categories[1]?.label).toBe("first");
    expect(config.services[0]?.name).toBe("first");
    expect(warn).toHaveBeenCalledOnce();

    let runtime: ReturnType<typeof createConsent> | undefined;
    expect(() => {
      runtime = createConsent({
        categories: ["analytics", "analytics", "Bad id"],
        services: [
          { id: "ga", category: "analytics" },
          { id: "ga", category: "analytics" },
          { id: "unknown", category: "missing" },
          { id: "bad-pattern", category: "analytics", cookies: [""] },
        ],
      });
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(runtime?.acceptAll().categories).toEqual({
      necessary: true,
      analytics: true,
    });
    expect(runtime?.hasService("ga")).toBe(true);
    expect(runtime?.hasService("unknown")).toBe(false);
  });
});
