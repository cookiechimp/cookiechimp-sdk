import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConsentConfig, ConsentRecord } from "@cookiechimp/core";
import { toPlatformConsent } from "@cookiechimp/core/consent-log";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useConsent } from "./index";
import {
  CookieBanner,
  CookiePreferences,
  PlatformConsentProvider,
  RecallButton,
} from "./platform";

const fixture = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../core/src/fixtures/platform-offline-bundle.json",
    ),
    "utf8",
  ),
);
let cleanup = () => {};
afterEach(() => {
  act(cleanup);
  document.body.replaceChildren();
  // biome-ignore lint/suspicious/noDocumentCookie: Reset only the test runtime cookie.
  document.cookie = "cc_platform_test=; Max-Age=0; Path=/";
});
const click = (text: string) => {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (node) =>
      node.textContent?.trim().replace(/^[+−]\s*/, "") === text &&
      !node.closest('[hidden], [aria-hidden="true"]'),
  );
  expect(button, text).toBeTruthy();
  act(() => button?.click());
};
const toggle = (name: string) =>
  document.querySelector<HTMLButtonElement>(
    `button[role="switch"][aria-label="${name}"]`,
  );
function State() {
  const state = useConsent();
  return <output>{JSON.stringify(state)}</output>;
}
function setup(
  control = "category_and_services",
  motion = true,
  onConsent?: ConsentConfig["onConsent"],
) {
  const bundle = structuredClone(fixture);
  bundle.banners.bnrEU1.preferences_gui_options.control_level = control;
  const analytics = bundle.categories.find(
    (category: { slug: string }) => category.slug === "analytics",
  );
  analytics.services.push({
    ...structuredClone(analytics.services[0]),
    id: "svcMATOMO",
    name: "Matomo",
    translations: { en: { name: "Matomo", description: "Site measurement" } },
  });
  const root = createRoot(
    document.body.appendChild(document.createElement("div")),
  );
  act(() =>
    root.render(
      <PlatformConsentProvider
        bundle={bundle}
        region="DE"
        locale="en"
        cookie={{ name: "cc_platform_test" }}
        motion={motion}
        onConsent={onConsent}
      >
        <CookieBanner />
        <CookiePreferences />
        <RecallButton />
        <State />
      </PlatformConsentProvider>,
    ),
  );
  cleanup = () => root.unmount();
  return bundle;
}
const saved = () =>
  JSON.parse(document.querySelector("output")?.textContent ?? "{}");
describe("platform JSON consent UI", () => {
  it("prompts again and blocks optional vendors when moving from US opt-out to DE opt-in", () => {
    const root = createRoot(
      document.body.appendChild(document.createElement("div")),
    );
    cleanup = () => root.unmount();
    const render = (region: string) =>
      act(() =>
        root.render(
          <PlatformConsentProvider
            bundle={fixture}
            region={region}
            locale="en"
            cookie={{ name: "cc_platform_test" }}
          >
            <CookieBanner />
            <CookiePreferences />
            <State />
          </PlatformConsentProvider>,
        ),
      );
    render("US");
    click("Accept All");
    const previousId = saved().consentId;
    expect(saved().services["google-analytics"]).toBe(true);
    render("DE");
    expect(document.querySelector('[data-cc-part="banner"]')).not.toBeNull();
    expect(saved().consentId).not.toBe(previousId);
    expect(saved().categories.analytics).toBe(false);
    expect(saved().services).toEqual({
      "session-management": true,
      "google-analytics": false,
      "microsoft-clarity": false,
      "meta-pixel": false,
    });
    click("Reject All");
    const optInId = saved().consentId;
    act(cleanup);
    document.body.replaceChildren();
    setup();
    expect(document.querySelector('[data-cc-part="banner"]')).toBeNull();
    expect(saved().consentId).toBe(optInId);
  });

  it("recreates consent when the same banner changes its consent mode", () => {
    const root = createRoot(
      document.body.appendChild(document.createElement("div")),
    );
    cleanup = () => root.unmount();
    const render = (bundle: typeof fixture) =>
      act(() =>
        root.render(
          <PlatformConsentProvider
            bundle={bundle}
            region="US"
            locale="en"
            cookie={{ name: "cc_platform_test" }}
          >
            <CookieBanner />
            <State />
          </PlatformConsentProvider>,
        ),
      );
    render(fixture);
    click("Accept All");
    const bundle = structuredClone(fixture);
    bundle.banners.bnrUS1.consent_mode = "opt-in";
    render(bundle);
    expect(document.querySelector('[data-cc-part="banner"]')).not.toBeNull();
    expect(saved().services["google-analytics"]).toBe(false);
  });

  it("shows the consent UUID used by backend records and restores it after remount", () => {
    const records: ConsentRecord[] = [];
    setup("category_and_services", true, (record) => records.push(record));
    click("Manage Preferences");
    const id = () =>
      document.querySelector('[data-cc-part="preferences-consent-id"]')
        ?.textContent;
    const original = saved().consentId;
    expect(original).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(id()).toBe(original);
    expect(
      document.querySelector(".cc-platform-consent-id")?.textContent,
    ).toContain("Your consent ID:");
    click("Save Preferences");
    const record = records[0];
    if (!record) throw new Error("Missing consent record");
    expect(
      toPlatformConsent(record, { url: "https://example.test" }).uuid,
    ).toBe(original);
    act(cleanup);
    document.body.replaceChildren();
    setup();
    act(() =>
      document
        .querySelector<HTMLButtonElement>('[data-cc-part="recall"]')
        ?.click(),
    );
    expect(id()).toBe(original);
    expect(
      document
        .querySelector('[data-cc-part="preferences-consent-id"]')
        ?.getAttribute("dir"),
    ).toBe("ltr");
  });

  it("enables motion by default and keeps collapsed details inert", () => {
    setup();
    expect(
      document
        .querySelector("[data-cc-platform]")
        ?.getAttribute("data-cc-motion"),
    ).toBe("on");
    click("Manage Preferences");
    const disclosure = document.querySelector<HTMLButtonElement>(
      ".cc-platform-category .cc-disclosure__label",
    );
    const details = document.getElementById(
      disclosure?.getAttribute("aria-controls") ?? "",
    );
    expect(details?.inert).toBe(true);
    expect(details?.getAttribute("aria-hidden")).toBe("true");
    click("Essential");
    expect(details?.inert).toBe(false);
    click("Essential");
    expect(details?.inert).toBe(true);
    expect(details?.getAttribute("aria-hidden")).toBe("true");
  });

  it("allows hosts to disable motion while preserving vendor consent", () => {
    setup("category_and_services", false);
    expect(
      document
        .querySelector("[data-cc-platform]")
        ?.getAttribute("data-cc-motion"),
    ).toBe("off");
    click("Manage Preferences");
    click("Analytics");
    act(() => toggle("Microsoft Clarity")?.click());
    click("Save Preferences");
    expect(saved().services).toMatchObject({
      "microsoft-clarity": true,
      "google-analytics": false,
    });
  });

  it("renders the shared copy, category/vendor disclosures and storage details", () => {
    setup();
    click("Manage Preferences");
    expect(
      document.querySelector('[data-cc-part="preferences"]')?.textContent,
    ).toContain("Cookie Settings");
    click("Analytics");
    click("Google Analytics");
    const expanded = document.querySelector('[data-cc-part="preferences"]');
    expect(expanded?.textContent).toContain("Google LLC");
    expect(expanded?.textContent).toContain("_ga");
    expect(expanded?.textContent).toContain("2 years");
    expect(expanded?.textContent).toContain("_ga_<container-id>");
    expect(
      expanded
        ?.querySelector('a[href="https://policies.google.com/privacy"]')
        ?.getAttribute("rel"),
    ).toContain("noopener");
    expect(toggle("Essential")?.disabled).toBe(true);
    click("Essential");
    expect(toggle("Session Management")?.disabled).toBe(true);
  });

  it("stages a single vendor, saves it and restores the selection when reopened", () => {
    setup();
    click("Manage Preferences");
    click("Analytics");
    act(() => toggle("Google Analytics")?.click());
    expect(saved().services).toMatchObject({
      "session-management": true,
      "google-analytics": false,
      "microsoft-clarity": false,
      matomo: false,
    });
    expect(toggle("Analytics")?.getAttribute("aria-checked")).toBe("true");
    expect(toggle("Matomo")?.getAttribute("aria-checked")).toBe("false");
    click("Save Preferences");
    expect(saved().services).toMatchObject({
      "google-analytics": true,
      matomo: false,
    });
    expect(saved().categories).toMatchObject({
      essential: true,
      analytics: true,
    });
    act(() =>
      document
        .querySelector<HTMLButtonElement>('[data-cc-part="recall"]')
        ?.click(),
    );
    click("Analytics");
    expect(toggle("Google Analytics")?.getAttribute("aria-checked")).toBe(
      "true",
    );
    act(() => toggle("Analytics")?.click());
    click("Save Preferences");
    expect(saved().services).toMatchObject({
      "google-analytics": false,
      matomo: false,
    });
  });

  it("keeps separate vendor edits when updates are batched", () => {
    setup();
    click("Manage Preferences");
    click("Analytics");
    act(() => {
      toggle("Google Analytics")?.click();
      toggle("Matomo")?.click();
    });
    click("Save Preferences");
    expect(saved().services).toMatchObject({
      "google-analytics": true,
      matomo: true,
    });
  });

  it("discards unsaved changes, supports category-only disclosure and rejects optional vendors", () => {
    setup("category_only");
    click("Manage Preferences");
    click("Analytics");
    expect(toggle("Google Analytics")).toBeNull();
    expect(
      document.querySelector('[aria-expanded="false"]')?.textContent,
    ).toBeTruthy();
    act(() => toggle("Analytics")?.click());
    const close = document.querySelector<HTMLButtonElement>(
      '[data-cc-part="preferences-close"]',
    );
    act(() => close?.click());
    click("Manage Preferences");
    expect(toggle("Analytics")?.getAttribute("aria-checked")).toBe("false");
    click("Reject All");
    expect(saved().services).toMatchObject({
      "session-management": true,
      "google-analytics": false,
      matomo: false,
    });
  });

  it("renders hostile disclosures as text and refuses executable privacy links", () => {
    const bundle = structuredClone(fixture);
    const analytics = bundle.categories.find(
      (category: { slug: string }) => category.slug === "analytics",
    );
    analytics.services[0].privacy_policy_url = "javascript:alert(1)";
    analytics.services[0].translations.en.description =
      '<img src=x onerror="alert(1)">Safe description';
    const root = createRoot(
      document.body.appendChild(document.createElement("div")),
    );
    act(() =>
      root.render(
        <PlatformConsentProvider
          bundle={bundle}
          region="DE"
          cookie={{ name: "cc_platform_test" }}
        >
          <CookieBanner />
          <CookiePreferences />
        </PlatformConsentProvider>,
      ),
    );
    cleanup = () => root.unmount();
    click("Manage Preferences");
    click("Analytics");
    click("Google Analytics");
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toContain("Safe description");
  });
});
