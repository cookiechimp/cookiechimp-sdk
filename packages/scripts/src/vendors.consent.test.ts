import { describe, expect, it, vi } from "vitest";
import { clarity } from "./clarity";
import { hotjar } from "./hotjar";
import type { ConsentSource, ScriptPreset } from "./index";
import { linkedin } from "./linkedin";
import { metaPixel } from "./meta-pixel";
import { posthog } from "./posthog";
import { segment } from "./segment";
import { tiktok } from "./tiktok";

type Categories = Record<string, boolean>;
function runtime(initial: Categories = {}) {
  let categories = initial;
  const listeners = new Set<(state: { categories: Categories }) => void>();
  const source: ConsentSource & { set(next: Categories): void } = {
    get: () => ({ categories }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      categories = next;
      for (const listener of listeners) listener({ categories });
    },
  };
  return source;
}

type Host = Record<string, unknown>;
type ApiCase = {
  name: string;
  category: string;
  other: string;
  build: () => ScriptPreset;
  /** Read the consent calls queued on the pre-load stub. */
  queued: (host: Host) => unknown[][];
  grant: unknown[];
  revoke: unknown[];
  /** Replace the stub with a fake loaded library and return its API spy. */
  load: (host: Host) => ReturnType<typeof vi.fn>;
  loadedGrant: unknown[];
  loadedRevoke: unknown[];
};

const fnQueue = (key: string) => (host: Host) =>
  (
    (host[key] as { q?: unknown[][]; queue?: unknown[][] }).q ??
    (host[key] as { queue: unknown[][] }).queue
  ).map((args) => Array.from(args as ArrayLike<unknown>));
const arrayQueue = (key: string) => (host: Host) =>
  (host[key] as unknown[][]).map((entry) => Array.from(entry));

const cases: ApiCase[] = [
  {
    name: "Meta Pixel",
    category: "marketing",
    other: "analytics",
    build: () => metaPixel({ pixelId: "123456789012345" }),
    queued: (host) =>
      fnQueue("fbq")(host).filter((args) => args[0] === "consent"),
    grant: ["consent", "grant"],
    revoke: ["consent", "revoke"],
    load(host) {
      const fbq = vi.fn();
      host.fbq = fbq;
      return fbq;
    },
    loadedGrant: ["consent", "grant"],
    loadedRevoke: ["consent", "revoke"],
  },
  {
    name: "Clarity",
    category: "analytics",
    other: "marketing",
    build: () => clarity({ projectId: "abcde12345" }),
    queued: fnQueue("clarity"),
    grant: ["consent", true],
    revoke: ["consent", false],
    load(host) {
      const api = vi.fn();
      host.clarity = api;
      return api;
    },
    loadedGrant: ["consent", true],
    loadedRevoke: ["consent", false],
  },
  {
    name: "PostHog",
    category: "analytics",
    other: "marketing",
    build: () =>
      posthog({
        apiKey: "phc_abcdefghijklmnopqrstuvwxyz0123456789ABC",
        globalName: "ph",
      }),
    queued: arrayQueue("ph"),
    grant: ["opt_in_capturing"],
    revoke: ["opt_out_capturing"],
    load(host) {
      const api = vi.fn();
      host.ph = {
        opt_in_capturing: () => api("opt_in_capturing"),
        opt_out_capturing: () => api("opt_out_capturing"),
      };
      return api;
    },
    loadedGrant: ["opt_in_capturing"],
    loadedRevoke: ["opt_out_capturing"],
  },
  {
    name: "TikTok",
    category: "marketing",
    other: "analytics",
    build: () => tiktok({ pixelId: "C4ABCDEFGHIJ12345678" }),
    queued: arrayQueue("ttq"),
    grant: ["grantConsent"],
    revoke: ["revokeConsent"],
    load(host) {
      const api = vi.fn();
      host.ttq = {
        grantConsent: () => api("grantConsent"),
        revokeConsent: () => api("revokeConsent"),
      };
      return api;
    },
    loadedGrant: ["grantConsent"],
    loadedRevoke: ["revokeConsent"],
  },
];

describe.each(cases)("$name consent API mapping", (c) => {
  it("reports api revoke behaviour", () => {
    expect(c.build().revoke).toBe("api");
  });

  it("queues a revoke on deny before the script loads, then a grant", () => {
    const host: Host = {};
    const consent = runtime();
    c.build().sync?.(consent, host);
    expect(c.queued(host)).toEqual([c.revoke]);
    consent.set({ [c.category]: true });
    expect(c.queued(host)).toEqual([c.revoke, c.grant]);
    consent.set({ [c.category]: false });
    expect(c.queued(host)).toEqual([c.revoke, c.grant, c.revoke]);
  });

  it("grants immediately when the category is already granted", () => {
    const host: Host = {};
    c.build().sync?.(runtime({ [c.category]: true }), host);
    expect(c.queued(host)).toEqual([c.grant]);
  });

  it("calls the loaded vendor API when consent is revoked after load", () => {
    const host: Host = {};
    const consent = runtime({ [c.category]: true });
    c.build().sync?.(consent, host);
    const api = c.load(host);
    consent.set({ [c.category]: false });
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenLastCalledWith(...c.loadedRevoke);
    consent.set({ [c.category]: true });
    expect(api).toHaveBeenLastCalledWith(...c.loadedGrant);
  });

  it("makes no call when only another category changes", () => {
    const host: Host = {};
    const consent = runtime({ [c.category]: true });
    c.build().sync?.(consent, host);
    const api = c.load(host);
    consent.set({ [c.category]: true, [c.other]: true });
    consent.set({ [c.category]: true, [c.other]: false });
    expect(api).not.toHaveBeenCalled();
  });

  it("stops calling after unsubscribe", () => {
    const host: Host = {};
    const consent = runtime({ [c.category]: true });
    const stop = c.build().sync?.(consent, host);
    const api = c.load(host);
    stop?.();
    consent.set({});
    expect(api).not.toHaveBeenCalled();
  });
});

describe.each([
  [
    "Segment",
    () => segment({ writeKey: "abcdefghijABCDEFGHIJ0123456789ab" }),
    "analytics",
  ],
  ["Hotjar", () => hotjar({ siteId: "1234567" }), "hj"],
  ["LinkedIn", () => linkedin({ partnerId: "123456" }), "lintrk"],
] as const)("%s reload-only revoke", (_name, build, global) => {
  it("reports reload revoke behaviour and makes no vendor call", () => {
    const preset = build();
    expect(preset.revoke).toBe("reload");
    const host: Host = {};
    const consent = runtime({ analytics: true, marketing: true });
    preset.sync?.(consent, host);
    const before = JSON.stringify(host[global]);
    consent.set({});
    expect(JSON.stringify(host[global])).toBe(before);
  });
});

describe("PostHog with a loaded library", () => {
  it("does not add an init queue to the loaded object", () => {
    const loaded = {
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    } as Record<string, unknown>;
    const host: Host = { posthog: loaded };
    posthog({ apiKey: "phc_abcdefghijklmnopqrstuvwxyz0123456789ABC" }).sync?.(
      runtime(),
      host,
    );
    expect(loaded._i).toBeUndefined();
    expect(loaded.opt_out_capturing).toHaveBeenCalledOnce();
  });
});
