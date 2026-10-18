import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsent, readConsentCookie } from "./index";

afterEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: expire the fixture cookie between tests.
  document.cookie = "cc_consent=; Path=/; Max-Age=0";
});

describe("browser consent", () => {
  function captureCookieWrite(run: () => void): string {
    let written = "";
    const prototype = Object.getPrototypeOf(document) as Document;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => descriptor?.get?.call(document) ?? "",
      set: (value: string) => {
        written = value;
        descriptor?.set?.call(document, value);
      },
    });
    try {
      run();
      return written;
    } finally {
      Reflect.deleteProperty(document, "cookie");
    }
  }

  it("persists state across runtime instances and notifies subscribers", () => {
    const first = createConsent({ categories: { analytics: false } });
    const listener = vi.fn();
    first.subscribe(listener);
    first.acceptAll();

    expect(document.cookie).toContain("cc_consent=v1.");
    expect(listener).toHaveBeenCalledOnce();
    const reloaded = createConsent({ categories: { analytics: false } });
    expect(reloaded.get().consentId).toBe(first.get().consentId);
    expect(reloaded.has("analytics")).toBe(true);
    expect(reloaded.get().action).toBe("accept_all");
  });

  it("persists and restores a per-service decision", () => {
    const config = {
      categories: ["analytics"],
      services: [{ id: "analytics-demo", category: "analytics" }],
    } as const;
    const first = createConsent(config);
    first.set({ services: { "analytics-demo": true } });
    expect(document.cookie).toContain("cc_consent=v1.");
    const second = createConsent(config);
    expect(second.hasService("analytics-demo")).toBe(true);
    expect(second.get().services).toEqual({ "analytics-demo": true });
  });

  it("does not turn inherited services into explicit overrides when saved and reloaded", () => {
    const config = {
      categories: ["analytics"],
      services: [
        { id: "metrics", category: "analytics" },
        { id: "heatmap", category: "analytics" },
      ],
    } as const;
    const first = createConsent(config);
    expect(first.get().services).toEqual({ metrics: false, heatmap: false });
    expect(readConsentCookie(document.cookie)).toBeNull();
    expect(first.needsDecision).toBe(true);
    first.set({
      categories: { analytics: true },
      services: { heatmap: false },
    });
    expect(readConsentCookie(document.cookie)?.services).toEqual({
      heatmap: false,
    });
    const second = createConsent(config);
    expect(second.get().services).toEqual({ metrics: true, heatmap: false });
    second.set({ categories: { analytics: false } });
    expect(second.get().services).toEqual({ metrics: false, heatmap: false });
  });

  it("writes safe default cookie attributes on HTTP", () => {
    const cookie = captureCookieWrite(() => {
      createConsent({ categories: [] }).acceptAll();
    });
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=15552000");
    expect(cookie).not.toContain("Secure");
  });

  it("writes configured domain, lifetime, and forced Secure attributes", () => {
    const cookie = captureCookieWrite(() => {
      createConsent({
        categories: [],
        cookie: { domain: ".example.com", maxAge: 60, secure: true },
      }).acceptAll();
    });
    expect(cookie).toContain("Domain=.example.com");
    expect(cookie).toContain("Max-Age=60");
    expect(cookie).toContain("Secure");
  });

  it("writes Secure by default on HTTPS", () => {
    vi.stubGlobal("location", { protocol: "https:" });
    const cookie = captureCookieWrite(() => {
      createConsent({ categories: [] }).acceptAll();
    });
    expect(cookie).toContain("Secure");
    vi.unstubAllGlobals();
  });
});
