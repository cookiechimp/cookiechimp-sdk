import { createConsent } from "@cookiechimp/core";
import de from "@cookiechimp/translations/de";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ConsentProvider } from "./index";
import {
  CookieBanner,
  CookiePreferences,
  GatedFrame,
  GatedScript,
  RecallButton,
} from "./ui";

afterEach(() => document.body.replaceChildren());

function setup() {
  const runtime = createConsent({
    categories: { analytics: false },
    regulation: "gdpr",
  });
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  act(() =>
    root.render(
      <ConsentProvider consent={runtime}>
        <CookieBanner />
        <CookiePreferences
          categories={[{ id: "analytics", label: "Analytics" }]}
        />
        <RecallButton />
        <GatedScript category="analytics">window.__ran = true</GatedScript>
        <GatedFrame category="analytics" src="/frame" title="Example" />
      </ConsentProvider>,
    ),
  );
  return { runtime, root };
}

describe("styled consent UI", () => {
  it("uses provider translations for defaults and preserves explicit props", () => {
    const runtime = createConsent({
      categories: { analytics: false },
      regulation: "gdpr",
    });
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    act(() =>
      root.render(
        <ConsentProvider consent={runtime} translations={de} language="de">
          <CookieBanner title="Eigener Titel" />
          <GatedFrame category="analytics" src="/frame" title="Example" />
        </ConsentProvider>,
      ),
    );
    expect(host.textContent).toContain("Eigener Titel");
    expect(host.textContent).toContain("Alle Cookies akzeptieren");
    expect(host.textContent).toContain(
      "Dieser Inhalt benötigt Ihre Zustimmung.",
    );
    expect(host.textContent).not.toContain("Ihre Datenschutzauswahl");
    act(() => root.unmount());
  });

  it("renders cc classes and preserves headless part and state attributes", () => {
    const { root } = setup();
    const banner = document.querySelector('[data-cc-part="banner"]');
    expect(banner?.classList.contains("cc-banner")).toBe(true);
    expect(banner?.getAttribute("data-cc-state")).toBe("open");
    expect(document.querySelector('[data-cc-part="recall"]')).toBeNull();
    act(() => root.unmount());
  });

  it("opens preferences from recall after a decision", () => {
    const { runtime, root } = setup();
    act(() => runtime.rejectAll());
    const recall = document.querySelector<HTMLButtonElement>(
      '[data-cc-part="recall"]',
    );
    act(() => recall?.click());
    expect(
      document.querySelector('[data-cc-part="preferences"]'),
    ).not.toBeNull();
    act(() => root.unmount());
  });

  it("keeps gated resources inert until the placeholder grants consent", () => {
    const { runtime, root } = setup();
    const frame = document.querySelector("iframe");
    expect(frame?.hasAttribute("src")).toBe(false);
    expect(document.querySelector('script[type="text/plain"]')).not.toBeNull();
    const allow = document.querySelector<HTMLButtonElement>(
      '[data-cc-part="gated-frame-placeholder"] button',
    );
    act(() => allow?.click());
    expect(runtime.has("analytics")).toBe(true);
    expect(frame?.getAttribute("src")).toBe("/frame");
    expect(
      document.querySelector('[data-cc-part="gated-frame-placeholder"]'),
    ).toBeNull();
    act(() => root.unmount());
  });
});
