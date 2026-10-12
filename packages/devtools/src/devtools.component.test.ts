// @vitest-environment happy-dom
import { type ConsentState, createConsent } from "@cookiechimp/core";
import { gateScripts } from "@cookiechimp/core/gate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DevtoolsConsent, mountDevtools } from "./index";
import { SIMULATION_KEY } from "./simulation";

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function fakeConsent(categories: Record<string, boolean> = {}) {
  let state = {
    consentId: "cid-1",
    ts: "2026-01-01T00:00:00.000Z",
    categories,
    action: "custom",
    schemaVersion: 1,
  } as ConsentState;
  const listeners = new Set<(state: ConsentState) => void>();
  const consent: DevtoolsConsent & {
    set(next: Record<string, boolean>): void;
  } = {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    region: { country: "US", region: "CA" },
    regulation: "ccpa",
    gpc: true,
    needsDecision: false,
    language: "en",
    set(next) {
      state = { ...state, categories: next };
      for (const listener of listeners) listener(state);
    },
  };
  return { consent, listeners };
}

const shadow = () =>
  document.querySelector("[data-cc-devtools]")?.shadowRoot as ShadowRoot;
const text = () => shadow().textContent ?? "";
const button = (name: string) =>
  [...shadow().querySelectorAll("button")].find(
    (node) => node.textContent === name,
  ) as HTMLButtonElement;

describe("mountDevtools", () => {
  it("shows state, region, regulation, GPC, language and config source", () => {
    const { consent } = fakeConsent({ analytics: true, marketing: false });
    mountDevtools({ consent, open: true, refreshMs: 0 });
    for (const part of [
      "cid-1",
      "US-CA",
      "ccpa",
      "GPC",
      "on",
      "en",
      "local",
      "analytics: granted",
      "marketing: denied",
      "Not connected (local mode)",
    ])
      expect(text()).toContain(part);
  });

  it("lists blocked scripts, iframes and requests from every blocker", () => {
    const { consent } = fakeConsent();
    const script = document.createElement("script");
    script.setAttribute("data-cc-src", "https://cdn.example.test/a.js");
    mountDevtools({
      consent,
      open: true,
      refreshMs: 0,
      blockers: [
        {
          blocked: () => [
            { el: script, category: "analytics", service: "ga4" },
          ],
        },
        {
          blocked: () => [
            {
              url: "https://api.example.test/x",
              kind: "fetch",
              category: "marketing",
              ts: 1,
            },
          ],
        },
      ],
    });
    expect(text()).toContain("Blocked (2)");
    expect(text()).toContain(
      "script https://cdn.example.test/a.js [analytics/ga4]",
    );
    expect(text()).toContain("fetch https://api.example.test/x [marketing]");
  });

  it("reads a real gateScripts controller", () => {
    const consent = createConsent({ categories: ["analytics"] });
    const script = document.createElement("script");
    script.type = "text/plain";
    script.setAttribute("data-cc-src", "https://cdn.example.test/gated.js");
    script.setAttribute("data-cc-category", "analytics");
    document.head.append(script);
    const gate = gateScripts(consent, { document });
    mountDevtools({ consent, blockers: [gate], open: true, refreshMs: 0 });
    expect(text()).toContain("https://cdn.example.test/gated.js [analytics]");
    gate.stop();
    script.remove();
  });

  it("shows the sync queue and dashboard config source", () => {
    const { consent } = fakeConsent();
    mountDevtools({
      consent,
      open: true,
      refreshMs: 0,
      configSource: "dashboard",
      sync: { queue: () => [{ action: "accept_all", ts: "t1" }] },
    });
    expect(text()).toContain("dashboard");
    expect(text()).toContain("Sync queue (1)");
    expect(text()).toContain('"action":"accept_all"');
  });

  it("refreshes on consent changes and on its timer", () => {
    vi.useFakeTimers();
    const { consent } = fakeConsent({ analytics: false });
    let blocked: { url: string; kind: string }[] = [];
    mountDevtools({
      consent,
      open: true,
      blockers: [{ blocked: () => blocked }],
    });
    consent.set({ analytics: true });
    expect(text()).toContain("analytics: granted");
    blocked = [{ url: "https://late.example.test", kind: "xhr" }];
    vi.advanceTimersByTime(1000);
    expect(text()).toContain("xhr https://late.example.test");
  });
});

describe("devtools security", () => {
  const markup =
    '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';

  it("renders untrusted values as text, never as markup", () => {
    const { consent } = fakeConsent({ [markup]: true });
    const state = consent.get();
    consent.get = () => ({ ...state, consentId: markup });
    mountDevtools({
      consent,
      open: true,
      refreshMs: 0,
      blockers: [
        { blocked: () => [{ url: markup, kind: "script", category: markup }] },
      ],
      sync: { queue: () => [{ note: markup }] },
    });
    const root = shadow();
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelectorAll("script")).toHaveLength(0);
    expect(text()).toContain(markup);
    expect(
      (window as typeof window & { __pwned?: number }).__pwned,
    ).toBeUndefined();
  });

  it("makes no network request while mounting, refreshing or simulating", () => {
    const spies = {
      fetch: vi.fn(),
      XMLHttpRequest: vi.fn(),
      WebSocket: vi.fn(),
      EventSource: vi.fn(),
      Image: vi.fn(),
    };
    for (const [name, spy] of Object.entries(spies)) vi.stubGlobal(name, spy);
    const beacon = vi.spyOn(navigator, "sendBeacon");
    const { consent } = fakeConsent();
    const reload = vi.fn();
    const tools = mountDevtools({ consent, refreshMs: 0, reload });
    tools.open();
    tools.refresh();
    consent.set({ analytics: true });
    const input = shadow().querySelector(
      "input[name=country]",
    ) as HTMLInputElement;
    input.value = "DE";
    button("Apply and reload").click();
    tools.close();
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(shadow().querySelector("link,iframe,script,img")).toBeNull();
  });

  it("puts the nonce on its style element", () => {
    mountDevtools({
      consent: fakeConsent().consent,
      nonce: "abc123",
      refreshMs: 0,
    });
    expect(shadow().querySelector("style")?.getAttribute("nonce")).toBe(
      "abc123",
    );
  });
});

describe("simulate region and GPC", () => {
  it("saves a valid simulation, previews the regulation and reloads", () => {
    const reload = vi.fn();
    mountDevtools({
      consent: fakeConsent().consent,
      reload,
      open: true,
      refreshMs: 0,
    });
    const root = shadow();
    const country = root.querySelector(
      "input[name=country]",
    ) as HTMLInputElement;
    const region = root.querySelector("input[name=region]") as HTMLInputElement;
    const gpc = root.querySelector("input[name=gpc]") as HTMLInputElement;
    country.value = "de";
    country.dispatchEvent(new Event("input"));
    expect(root.querySelector("[data-cc-devtools-preview]")?.textContent).toBe(
      "Simulated regulation: gdpr",
    );
    country.value = "US";
    region.value = "ca";
    gpc.checked = true;
    gpc.dispatchEvent(new Event("input"));
    expect(root.querySelector("[data-cc-devtools-preview]")?.textContent).toBe(
      "Simulated regulation: ccpa",
    );
    button("Apply and reload").click();
    expect(JSON.parse(sessionStorage.getItem(SIMULATION_KEY) ?? "")).toEqual({
      region: { country: "US", region: "CA" },
      gpc: true,
    });
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(["D", "DE1", "<s", "D/", "1?"])(
    "rejects a malformed country %s without saving or reloading",
    (value) => {
      const reload = vi.fn();
      mountDevtools({
        consent: fakeConsent().consent,
        reload,
        open: true,
        refreshMs: 0,
      });
      const country = shadow().querySelector(
        "input[name=country]",
      ) as HTMLInputElement;
      country.value = value;
      button("Apply and reload").click();
      expect(sessionStorage.getItem(SIMULATION_KEY)).toBeNull();
      expect(reload).not.toHaveBeenCalled();
      expect(shadow().querySelector("[role=alert]")?.textContent).not.toBe("");
    },
  );

  it("shows and clears an active simulation", () => {
    sessionStorage.setItem(
      SIMULATION_KEY,
      JSON.stringify({ region: { country: "FR" }, gpc: true }),
    );
    const reload = vi.fn();
    mountDevtools({
      consent: fakeConsent().consent,
      reload,
      open: true,
      refreshMs: 0,
    });
    expect(text()).toContain("FR, GPC on");
    expect(
      (shadow().querySelector("input[name=country]") as HTMLInputElement).value,
    ).toBe("FR");
    button("Clear simulation").click();
    expect(sessionStorage.getItem(SIMULATION_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe("panel behaviour", () => {
  it("toggles with aria-expanded, closes on Escape and returns focus", () => {
    mountDevtools({ consent: fakeConsent().consent, refreshMs: 0 });
    const toggle = button("CookieChimp");
    const panel = shadow().querySelector("[role=dialog]") as HTMLElement;
    expect(panel.hidden).toBe(true);
    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(shadow().activeElement).toBe(toggle);
  });

  it("unmounts, unsubscribes and stops its timer", () => {
    vi.useFakeTimers();
    const { consent, listeners } = fakeConsent();
    const blocked = vi.fn(() => []);
    const tools = mountDevtools({
      consent,
      open: true,
      blockers: [{ blocked }],
    });
    tools.unmount();
    blocked.mockClear();
    vi.advanceTimersByTime(5000);
    expect(blocked).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
    expect(document.querySelector("[data-cc-devtools]")).toBeNull();
  });

  it("does not mount in production unless allowed", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      mountDevtools({ consent: fakeConsent().consent }).element,
    ).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-cc-devtools]")).toBeNull();
    expect(
      mountDevtools({
        consent: fakeConsent().consent,
        allowProduction: true,
        refreshMs: 0,
      }).element,
    ).not.toBeNull();
  });

  it.each([
    ["missing consent", {}],
    [
      "bad config source",
      { consent: fakeConsent().consent, configSource: "remote" },
    ],
    ["negative refresh", { consent: fakeConsent().consent, refreshMs: -1 }],
    ["bad blocker", { consent: fakeConsent().consent, blockers: [{}] }],
    ["bad sync", { consent: fakeConsent().consent, sync: {} }],
  ])(
    "throws in development and warns in production for %s",
    (_name, options) => {
      expect(() => mountDevtools(options as never)).toThrow(
        /CookieChimp devtools/,
      );
      vi.stubEnv("NODE_ENV", "production");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(mountDevtools(options as never).element).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    },
  );

  it("keeps working when a blocker or the sync queue throws", () => {
    mountDevtools({
      consent: fakeConsent().consent,
      open: true,
      refreshMs: 0,
      blockers: [
        {
          blocked: () => {
            throw new Error("boom");
          },
        },
      ],
      sync: {
        queue: () => {
          throw new Error("boom");
        },
      },
    });
    expect(text()).toContain("Nothing blocked");
    expect(text()).toContain("Queue empty");
  });

  describe("without process (script tag or CDN build)", () => {
    it("does not mount unless allowProduction is set", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("process", undefined);
      const hidden = mountDevtools({ consent: fakeConsent().consent });
      const shown = mountDevtools({
        consent: fakeConsent().consent,
        allowProduction: true,
        refreshMs: 0,
      });
      vi.unstubAllGlobals();
      expect(hidden.element).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
      expect(shown.element).not.toBeNull();
      expect(document.querySelectorAll("[data-cc-devtools]")).toHaveLength(1);
    });

    it("warns instead of throwing for invalid options", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("process", undefined);
      const tools = mountDevtools({} as never);
      vi.unstubAllGlobals();
      expect(tools.element).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    });
  });
});
