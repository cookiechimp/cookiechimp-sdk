import { afterEach, describe, expect, it, vi } from "vitest";
import { consentModeDefault, consentModeInlineScript } from "./consent-mode";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("consentModeDefault", () => {
  it("denies all non-security signals regardless of category grants", () => {
    expect(
      consentModeDefault({
        categories: { analytics: true, marketing: true, functional: true },
      }),
    ).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "denied",
      personalization_storage: "denied",
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
      analytics_storage: "denied",
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
    ).toMatchObject({ ad_storage: "denied", analytics_storage: "denied" });
    expect(
      consentModeDefault({
        categories: { analytics: true },
        mapping: { analytics: null },
      }).analytics_storage,
    ).toBe("denied");
  });

  it("embeds the inline payload through the escaping serialiser", () => {
    const script = consentModeInlineScript({ region: ["US-CA"] });
    expect(() => new Function("window", script)).not.toThrow();
    const dataLayer: ArrayLike<unknown>[] = [];
    new Function("window", script)({ dataLayer });
    expect(Array.from(dataLayer[0] ?? [])[2]).toMatchObject({
      region: ["US-CA"],
    });
  });

  it.each(["</script>", "us", "\u2028", "USA-CALIF"])(
    "rejects non-ISO region %j in development",
    (code) => {
      vi.stubEnv("NODE_ENV", "development");
      expect(() => consentModeInlineScript({ region: [code] })).toThrow(
        "ISO region codes",
      );
    },
  );

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
