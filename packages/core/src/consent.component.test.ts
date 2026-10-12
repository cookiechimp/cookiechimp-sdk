import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsent } from "./index";

afterEach(() => {
  // biome-ignore lint/suspicious/noDocumentCookie: expire the fixture cookie between tests.
  document.cookie = "cc_consent=; Path=/; Max-Age=0";
});

describe("browser consent", () => {
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
});
