import { afterEach, describe, expect, it, vi } from "vitest";
import { ga4 } from "./ga4";
import { googleAds } from "./google-ads";
import { gtm } from "./gtm";
import { applyPresets } from "./index";

afterEach(() => vi.unstubAllEnvs());
describe("Google presets", () => {
  it("builds gated GA4 and Ads definitions", () => {
    expect(ga4({ measurementId: "G-TEST1" })).toMatchObject({
      id: "ga4",
      category: "analytics",
      load: "gated",
      script: { attributes: { type: "text/plain", "data-cc-service": "ga4" } },
    });
    expect(googleAds({ conversionId: "AW-123" }).service.domains).toContain(
      "*.doubleclick.net",
    );
  });
  it("supports basic and advanced GTM", () => {
    expect(gtm({ containerId: "GTM-TEST", category: "analytics" }).load).toBe(
      "gated",
    );
    const advanced = gtm({
      containerId: "GTM-TEST",
      category: "analytics",
      consentMode: "advanced",
    });
    const target: {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    } = {};
    advanced.queue.install(target)("event", "early");
    expect(target.dataLayer).toHaveLength(2);
    expect(Array.from(target.dataLayer?.[0] as ArrayLike<unknown>)).toEqual([
      "consent",
      "default",
      expect.objectContaining({ analytics_storage: "denied" }),
    ]);
  });
  it("merges services and mappings", () => {
    const output = applyPresets(
      {
        categories: ["analytics", "marketing"],
        services: [{ id: "own", category: "analytics" }],
        consentMode: { mapping: { custom: ["analytics_storage"] } },
      },
      [ga4({ measurementId: "G-X" }), googleAds({ conversionId: "AW-X" })],
    );
    expect(output.services.map(({ id }) => id)).toEqual([
      "own",
      "ga4",
      "google-ads",
    ]);
    expect(output.consentMode.mapping?.marketing).toEqual([
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
    ]);
  });
  it("throws in development and warns in production", () => {
    expect(() => ga4({ measurementId: "bad" })).toThrow(/invalid/);
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => googleAds({ conversionId: "bad" })).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
