import { afterEach, describe, expect, it, vi } from "vitest";
import { gateScripts } from "./iframes";

const consent = {
  has: () => false,
  hasService: () => false,
  subscribe: () => () => {},
};
const originalEnvironment = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnvironment;
  vi.restoreAllMocks();
});

describe("gateScripts SSR", () => {
  it("returns a no-op controller without document or window and never throws", () => {
    expect(globalThis.document).toBeUndefined();
    expect(globalThis.window).toBeUndefined();
    const controller = gateScripts(consent);
    expect(controller.blocked()).toEqual([]);
    expect(() => {
      controller.scan();
      controller.stop();
    }).not.toThrow();
  });
});

describe("gateScripts option validation", () => {
  it.each([
    ["placeholder", { placeholder: "invalid" as never }],
    ["blockDynamic", { blockDynamic: "invalid" as never }],
  ])("throws a typed error for invalid %s in development", (name, options) => {
    process.env.NODE_ENV = "development";
    expect(() => gateScripts(consent, options)).toThrowError(TypeError);
    expect(() => gateScripts(consent, options)).toThrow(name);
  });

  it.each([
    ["placeholder", { placeholder: "invalid" as never }],
    ["blockDynamic", { blockDynamic: "invalid" as never }],
  ])("warns once and continues for invalid %s in production", (_, options) => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const controller = gateScripts(consent, options);
    expect(warn).toHaveBeenCalledOnce();
    expect(controller.blocked()).toEqual([]);
  });

  it("warns once and continues when process is unavailable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const savedProcess = globalThis.process;
    // @ts-expect-error Test the browser bundle path where Node's process global is absent.
    globalThis.process = undefined;
    try {
      expect(() =>
        gateScripts(consent, { placeholder: "invalid" as never }),
      ).not.toThrow();
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      globalThis.process = savedProcess;
    }
  });
});
