import { describe, expect, it, vi } from "vitest";
import { gateScripts } from "./iframes";

describe("gateScripts outside a browser", () => {
  it("returns an SSR-safe no-op", () => {
    const controller = gateScripts({
      has: () => false,
      hasService: () => false,
      subscribe: () => () => {},
    });
    expect(controller.blocked()).toEqual([]);
    expect(() => {
      controller.scan();
      controller.stop();
    }).not.toThrow();
  });

  it("throws for invalid options in development and warns in production", () => {
    const old = process.env.NODE_ENV;
    const consent = {
      has: () => false,
      hasService: () => false,
      subscribe: () => () => {},
    };
    process.env.NODE_ENV = "development";
    expect(() =>
      gateScripts(consent, { blockDynamic: "yes" as never }),
    ).toThrow("blockDynamic");
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      gateScripts(consent, { blockDynamic: "yes" as never }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    process.env.NODE_ENV = old;
  });
});
