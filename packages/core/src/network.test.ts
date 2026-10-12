import { afterEach, describe, expect, it, vi } from "vitest";
import { blockNetwork } from "./network";

const consent = { hasService: () => false };
const config = { categories: ["analytics"], services: [] };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("blockNetwork options", () => {
  it("returns an SSR no-op without a window", () => {
    const controller = blockNetwork(consent, { config });
    expect(controller.blocked()).toEqual([]);
    expect(() => controller.stop()).not.toThrow();
  });

  it("throws for invalid options in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => blockNetwork(consent, undefined as never)).toThrowError(
      "Invalid blockNetwork options",
    );
    expect(() =>
      blockNetwork(consent, { config, onBlock: true as never }),
    ).toThrowError("Invalid blockNetwork options");
  });

  it("warns and returns a no-op for invalid options in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const controller = blockNetwork(consent, undefined as never);
    expect(warn).toHaveBeenCalledOnce();
    expect(controller.blocked()).toEqual([]);
  });
});
