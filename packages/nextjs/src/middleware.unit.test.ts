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
        provider:
          provider === "custom" ? { header: "x-host-country" } : provider,
      }).get("x-cc-region"),
    ).toBe(expected);
  });

  it("reads nothing without an explicitly selected provider", () => {
    const result = withRegionHeaders(
      new Headers({
        "x-cc-region": "FR",
        "x-vercel-ip-country": "US",
        "cf-ipcountry": "DE",
      }),
    );
    expect(result.get("x-cc-region")).toBeNull();
  });

  it("reads only the selected provider", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "US",
      "cf-ipcountry": "DE",
      "x-host-country": "FR",
    });
    expect(
      withRegionHeaders(headers, { provider: "vercel" }).get("x-cc-region"),
    ).toBe("US");
    expect(
      withRegionHeaders(headers, { provider: "cloudflare" }).get("x-cc-region"),
    ).toBe("DE");
    expect(
      withRegionHeaders(headers, {
        provider: { header: "x-host-country" },
      }).get("x-cc-region"),
    ).toBe("FR");
  });

  it.each([
    undefined,
    "vercel",
    "cloudflare",
    { header: "x-host-country" },
  ] as const)("removes spoofed output for provider %j", (provider) => {
    expect(
      withRegionHeaders(new Headers({ "x-cc-region": "DE" }), {
        provider,
      }).has("x-cc-region"),
    ).toBe(false);
  });

  it("throws in development and warns in production", () => {
    expect(() =>
      withRegionHeaders(new Headers(), { provider: "invalid" as "vercel" }),
    ).toThrow("provider");
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    withRegionHeaders(new Headers(), { provider: "invalid" as "vercel" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});
