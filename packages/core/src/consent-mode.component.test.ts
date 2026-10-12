import { afterEach, describe, expect, it, vi } from "vitest";
import { consentModeInlineScript, installConsentMode } from "./consent-mode";

function runtime(categories: Record<string, boolean>, needsDecision = true) {
  type State = { categories: Record<string, boolean> };
  let state: State = { categories };
  const listeners = new Set<(state: State) => void>();
  return {
    needsDecision,
    get: () => state,
    subscribe(listener: (state: State) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: Record<string, boolean>) {
      state = { categories: next };
      for (const listener of listeners) listener(state);
    },
  };
}

afterEach(() => {
  delete (window as typeof window & { dataLayer?: unknown[] }).dataLayer;
  delete (window as typeof window & { gtag?: unknown }).gtag;
  delete (window as typeof window & { __ccConsentModeDefault?: boolean })
    .__ccConsentModeDefault;
  vi.restoreAllMocks();
});

describe("installConsentMode", () => {
  it("pushes default before a tag and updates on accept and reject", () => {
    const consent = runtime({ analytics: false });
    installConsentMode(consent);
    const layer = (
      window as typeof window & { dataLayer: ArrayLike<unknown>[] }
    ).dataLayer;
    layer.push(["event", "tag"]);
    expect(Array.from(layer[0] ?? [])).toMatchObject([
      "consent",
      "default",
      { analytics_storage: "denied" },
    ]);
    expect(Object.prototype.toString.call(layer[0])).toBe("[object Arguments]");
    consent.set({ analytics: true });
    consent.set({ analytics: false });
    expect(layer.map((entry) => Array.from(entry)[1])).toEqual([
      "default",
      "tag",
      "update",
      "update",
    ]);
  });

  it("does not update unchanged signals and stop unsubscribes", () => {
    const consent = runtime({ analytics: false });
    const controller = installConsentMode(consent);
    const layer = (
      window as typeof window & { dataLayer: ArrayLike<unknown>[] }
    ).dataLayer;
    consent.set({ analytics: false, unrelated: true });
    controller.stop();
    consent.set({ analytics: true });
    expect(layer).toHaveLength(1);
  });

  it("preserves an existing gtag", () => {
    const gtag = vi.fn();
    (window as typeof window & { gtag: typeof gtag }).gtag = gtag;
    installConsentMode(runtime({ analytics: false }));
    expect((window as typeof window & { gtag: typeof gtag }).gtag).toBe(gtag);
    expect(gtag).toHaveBeenCalledWith(
      "consent",
      "default",
      expect.objectContaining({ analytics_storage: "denied" }),
    );
  });

  it("immediately updates a returning visitor", () => {
    installConsentMode(runtime({ analytics: true }, false));
    const layer = (
      window as typeof window & { dataLayer: ArrayLike<unknown>[] }
    ).dataLayer;
    expect(layer.map((entry) => Array.from(entry).slice(0, 2))).toEqual([
      ["consent", "default"],
      ["consent", "update"],
    ]);
  });

  it("does not repeat an inline default and still updates returning visitors", () => {
    // biome-ignore lint/security/noGlobalEval: exercises the generated browser script in happy-dom.
    window.eval(consentModeInlineScript());
    const layer = (
      window as typeof window & { dataLayer: ArrayLike<unknown>[] }
    ).dataLayer;
    layer.push(["event", "tag"]);
    installConsentMode(runtime({ analytics: true }, false));
    const entries = layer.map((entry) => Array.from(entry));
    expect(entries.filter((entry) => entry[1] === "default")).toHaveLength(1);
    expect(entries.findIndex((entry) => entry[1] === "default")).toBeLessThan(
      entries.findIndex((entry) => entry[0] === "event"),
    );
    expect(entries.slice(2).some((entry) => entry[1] === "default")).toBe(
      false,
    );
    expect(entries.at(-1)).toMatchObject([
      "consent",
      "update",
      { analytics_storage: "granted" },
    ]);
    for (const entry of [layer[0], layer.at(-1)])
      expect(Object.prototype.toString.call(entry)).toBe("[object Arguments]");
  });

  it("can suppress the runtime default", () => {
    installConsentMode(runtime({ analytics: false }), { default: false });
    expect(
      (window as typeof window & { dataLayer: unknown[] }).dataLayer,
    ).toHaveLength(0);
  });
});
