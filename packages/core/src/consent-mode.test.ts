import { afterEach, describe, expect, it, vi } from "vitest";
import { consentModeDefault, consentModeInlineScript } from "./consent-mode";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("consentModeDefault", () => {
  it("maps categories to all Consent Mode v2 signals", () => {
    expect(
      consentModeDefault({
        categories: { analytics: true, marketing: true, functional: true },
      }),
    ).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
      functionality_storage: "granted",
      personalization_storage: "granted",
      security_storage: "granted",
      wait_for_update: 500,
    });
  });

  it("supports custom mappings, regions, and wait time", () => {
    expect(
      consentModeDefault({
        categories: { measurement: true },
        mapping: { measurement: ["analytics_storage"] },
        region: ["US-CA", "DE"],
        wait_for_update: 250,
      }),
    ).toMatchObject({
      analytics_storage: "granted",
      ad_storage: "denied",
      security_storage: "granted",
      region: ["US-CA", "DE"],
      wait_for_update: 250,
    });
  });

  it("can replace and remove built-in mappings", () => {
    expect(
      consentModeDefault({
        categories: { analytics: true, measurement: true },
        mapping: { measurement: ["ad_storage"] },
        replace: true,
      }),
    ).toMatchObject({ ad_storage: "granted", analytics_storage: "denied" });
    expect(
      consentModeDefault({
        categories: { analytics: true },
        mapping: { analytics: null },
      }).analytics_storage,
    ).toBe("denied");
  });

  it("escapes HTML and JavaScript separators while preserving values", () => {
    const region = "</script>\u2028x\u2029";
    const script = consentModeInlineScript({
      region: [region],
    });
    expect(script).not.toContain("</script>");
    expect(script).not.toContain("\u2028");
    expect(script).not.toContain("\u2029");
    expect(script).toContain("\\u003c/script>");
    expect(script).toContain("\\u2028");
    expect(script).toContain("\\u2029");
    expect(() => new Function("window", script)).not.toThrow();
    const dataLayer: ArrayLike<unknown>[] = [];
    new Function("window", script)({ dataLayer });
    expect(Array.from(dataLayer[0] ?? [])[2]).toMatchObject({
      region: [region],
    });
  });

  it("throws for invalid options in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => consentModeDefault({ wait_for_update: -1 })).toThrow(
      "wait_for_update",
    );
  });

  it("warns and uses safe defaults in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(consentModeDefault({ wait_for_update: Number.NaN })).toMatchObject({
      wait_for_update: 500,
    });
    expect(warn).toHaveBeenCalledOnce();
  });
});
