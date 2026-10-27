import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createConsent } from "./index";
import { adaptPlatformConfig } from "./sync";

const bundle = JSON.parse(
  readFileSync(
    new URL("./fixtures/platform-offline-bundle.json", import.meta.url),
    "utf8",
  ),
);
describe("platform consent disclosures", () => {
  it("keeps localized category, vendor and cookie metadata under the platform keys", () => {
    const dashboard = adaptPlatformConfig(bundle, {
      region: "DE",
      locale: "de",
    });
    const analytics = dashboard?.preferences?.find(
      (category) => category.slug === "analytics",
    );
    expect(analytics?.name).toBe("Statistik");
    expect(analytics?.services[0]).toMatchObject({
      id: "svcGA4",
      consent_key: "google-analytics",
      name: "Google Analyse",
      company: "Google LLC",
      privacy_policy_url: "https://policies.google.com/privacy",
    });
    expect(analytics?.services[0]?.storage_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "_ga",
          type: "cookie",
          duration: "2 years",
          description: "Distinguishes visitors for website usage measurement.",
        }),
        expect.objectContaining({ name: "_ga_<container-id>", type: "cookie" }),
      ]),
    );
    expect(analytics?.services[0]?.consent_key).toBe(
      dashboard?.services.find((service) => service.category === "analytics")
        ?.id,
    );
  });

  it("passes a mobile SDK's app store style data labels through as sent", () => {
    const mobile = structuredClone(bundle);
    const analytics = mobile.categories.find(
      (category: { slug: string }) => category.slug === "analytics",
    );
    analytics.services[0].app_data = {
      collected: ["device_id", 4, "crash_data"],
      purposes: ["analytics"],
      tracking: "yes",
      retention: "14 months",
      packages: { ios: ["FirebaseAnalytics"], android: "nope" },
    };
    const dashboard = adaptPlatformConfig(mobile, { region: "DE" });
    expect(
      dashboard?.preferences?.find((category) => category.slug === "analytics")
        ?.services[0]?.app_data,
    ).toEqual(analytics.services[0].app_data);
  });

  it("keeps every required platform category and its vendors enabled through reject, custom choices and restore", () => {
    const config = {
      categories: [{ id: "essential", required: true }, { id: "analytics" }],
      services: [
        { id: "session", category: "essential" },
        { id: "metrics", category: "analytics" },
      ],
      regulation: "gdpr" as const,
    };
    const runtime = createConsent(config);
    expect(runtime.has("essential")).toBe(true);
    runtime.rejectAll();
    runtime.set({
      categories: { essential: false },
      services: { session: false },
    });
    expect(runtime.has("essential")).toBe(true);
    expect(runtime.hasService("session")).toBe(true);
    const restored = createConsent({
      ...config,
      initial: {
        ...runtime.get(),
        categories: { necessary: true, essential: false, analytics: false },
        services: { session: false },
      },
    });
    expect(restored.has("essential")).toBe(true);
    expect(restored.get().services?.session).toBe(true);
  });

  it("does not let a vendor override bypass GPC for a sale/share category", () => {
    const config = {
      categories: ["advertising"],
      services: [{ id: "ads", category: "advertising" }],
      regulation: "ccpa" as const,
    };
    const first = createConsent({ ...config, gpc: false });
    first.acceptAll();
    const runtime = createConsent({
      ...config,
      initial: first.get(),
      gpc: true,
    });
    expect(runtime.hasService("ads")).toBe(false);
    expect(runtime.get().services?.ads).toBe(false);
    runtime.set({ services: { ads: true } });
    expect(runtime.hasService("ads")).toBe(false);
    expect(runtime.get().services?.ads).toBe(false);
  });
});
