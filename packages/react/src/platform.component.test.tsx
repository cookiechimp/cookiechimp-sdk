import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
      !node.closest("[hidden]"),
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
function setup(control = "category_and_services") {
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
  it("renders the shared copy, category/vendor disclosures and storage details", () => {
    setup();
    click("Manage Preferences");
    expect(
      document.querySelector('[data-cc-part="preferences"]')?.textContent,
    ).toContain("Cookie Settings");
    click("Analytics");
    click("Google Analytics");
    const expanded = document.querySelector('[data-cc-part="preferences"]');
    expect(expanded?.textContent).toContain("Example Ltd");
    expect(expanded?.textContent).toContain("_ga");
    expect(expanded?.textContent).toContain("2 years");
    expect(expanded?.textContent).toContain("local storage");
    expect(
      expanded
        ?.querySelector('a[href="https://example.test/privacy"]')
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
    expect(saved().services).toBeUndefined();
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
