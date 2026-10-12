import { describe, expect, it, vi } from "vitest";
import { withRegionHeaders } from "./middleware";

describe("withRegionHeaders", () => {
  it.each([
    [
      "vercel",
      { "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "CA" },
      "US-CA",
    ],
    ["cloudflare", { "cf-ipcountry": "DE" }, "DE"],
    ["custom", { "x-host-country": "FR" }, "FR"],
  ] as const)("reads %s host headers", (provider, values, expected) => {
    expect(
      withRegionHeaders(new Headers(values), {
        provider,
        ...(provider === "custom" ? { header: "x-host-country" } : {}),
      }).get("x-cc-region"),
    ).toBe(expected);
  });

  it("removes spoofed output when no trusted region exists", () => {
    expect(
      withRegionHeaders(new Headers({ "x-cc-region": "DE" }), {
        provider: "cloudflare",
      }).has("x-cc-region"),
    ).toBe(false);
  });

  it("throws in development and warns in production", () => {
    expect(() => withRegionHeaders(new Headers(), {})).toThrow("provider");
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    withRegionHeaders(new Headers(), {});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});
