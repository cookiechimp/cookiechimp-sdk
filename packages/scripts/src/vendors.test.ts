import { consentModeDefault } from "@cookiechimp/core/consent-mode";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clarity } from "./clarity";
import { hotjar } from "./hotjar";
import { applyPresets, type ScriptPreset } from "./index";
import { linkedin } from "./linkedin";
import { metaPixel } from "./meta-pixel";
import { posthog } from "./posthog";
import { segment } from "./segment";
import { encodeId } from "./shared";
import { tiktok } from "./tiktok";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ids = {
  meta: "123456789012345",
  clarity: "abcde12345",
  posthog: "phc_abcdefghijklmnopqrstuvwxyz0123456789ABC",
  segment: "abcdefghijABCDEFGHIJ0123456789ab",
  hotjar: "1234567",
  linkedin: "123456",
  tiktok: "C4ABCDEFGHIJ12345678",
};

type Case = {
  name: string;
  id: string;
  category: string;
  origin: string;
  global: string;
  idInUrl: boolean;
  build: (id: string) => ScriptPreset;
};
const cases: Case[] = [
  {
    name: "Meta Pixel",
    id: ids.meta,
    category: "marketing",
    origin: "https://connect.facebook.net",
    global: "fbq",
    idInUrl: false,
    build: (pixelId) => metaPixel({ pixelId }),
  },
  {
    name: "Clarity",
    id: ids.clarity,
    category: "analytics",
    origin: "https://www.clarity.ms",
    global: "clarity",
    idInUrl: true,
    build: (projectId) => clarity({ projectId }),
  },
  {
    name: "PostHog",
    id: ids.posthog,
    category: "analytics",
    origin: "https://us-assets.i.posthog.com",
    global: "posthog",
    idInUrl: false,
    build: (apiKey) => posthog({ apiKey }),
  },
  {
    name: "Segment",
    id: ids.segment,
    category: "analytics",
    origin: "https://cdn.segment.com",
    global: "analytics",
    idInUrl: true,
    build: (writeKey) => segment({ writeKey }),
  },
  {
    name: "Hotjar",
    id: ids.hotjar,
    category: "analytics",
    origin: "https://static.hotjar.com",
    global: "hj",
    idInUrl: true,
    build: (siteId) => hotjar({ siteId }),
  },
  {
    name: "LinkedIn",
    id: ids.linkedin,
    category: "marketing",
    origin: "https://snap.licdn.com",
    global: "lintrk",
    idInUrl: false,
    build: (partnerId) => linkedin({ partnerId }),
  },
  {
    name: "TikTok",
    id: ids.tiktok,
    category: "marketing",
    origin: "https://analytics.tiktok.com",
    global: "ttq",
    idInUrl: true,
    build: (pixelId) => tiktok({ pixelId }),
  },
];

describe.each(cases)("$name preset", (c) => {
  it("is gated, inert and in its default category", () => {
    const preset = c.build(c.id);
    expect(preset.load).toBe("gated");
    expect(preset.category).toBe(c.category);
    expect(preset.service.category).toBe(c.category);
    expect(preset.script.attributes).toMatchObject({
      type: "text/plain",
      "data-cc-src": preset.script.src,
      "data-cc-category": c.category,
      "data-cc-service": preset.id,
    });
    expect(preset.script.attributes.src).toBeUndefined();
    expect(new URL(preset.script.src).origin).toBe(c.origin);
    if (c.idInUrl) expect(preset.script.src).toContain(c.id);
  });

  it("maps no Google Consent Mode signal and keeps core's defaults", () => {
    const preset = c.build(c.id);
    expect(preset.consentMode).toEqual({});
    const config = applyPresets({ categories: ["analytics", "marketing"] }, [
      preset,
    ]);
    expect(config.consentMode.mapping).toEqual({});
    expect(consentModeDefault(config.consentMode)).toEqual(
      consentModeDefault(),
    );
    expect(config.services.at(-1)?.id).toBe(preset.id);
  });

  it("installs a queue stub with no network or DOM access", () => {
    const spies = {
      fetch: vi.fn(),
      XMLHttpRequest: vi.fn(),
      Image: vi.fn(),
      WebSocket: vi.fn(),
    };
    for (const [name, spy] of Object.entries(spies)) vi.stubGlobal(name, spy);
    const beacon = vi.fn();
    const createElement = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.stubGlobal("document", { createElement });
    const target: Record<string, unknown> = {};
    const preset = c.build(c.id);
    expect(preset.queue.dataLayerName).toBe(c.global);
    const call = preset.queue.install(target as never);
    call("track", "early", { value: 1 });
    expect(target[c.global]).toBeDefined();
    expect(JSON.stringify(target[c.global])).not.toBe("[]");
    for (const spy of [...Object.values(spies), beacon, createElement])
      expect(spy).not.toHaveBeenCalled();
  });

  it("keeps an existing global and does not install twice", () => {
    const preset = c.build(c.id);
    const target: Record<string, unknown> = {};
    preset.queue.install(target as never);
    const first = target[c.global];
    preset.queue.install(target as never);
    expect(target[c.global]).toBe(first);
  });

  it("throws on invalid ids in development and warns in production", () => {
    expect(() => c.build("bad")).toThrow(/invalid/);
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => c.build("bad")).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});

const injections = [
  '1"onload="x',
  "1'><script>alert(1)</script>",
  "<script>",
  "../../evil",
  "1?x=1&y=2",
  "//evil.com",
  "https://evil.com/x.js",
  "1#frag",
  "1 ",
  "a/b",
  "__proto__",
  "",
];

describe.each(cases)("$name id safety", (c) => {
  it("rejects injection attempts in development", () => {
    for (const id of injections) {
      expect(() => c.build(id)).toThrow(/invalid/);
      if (id) expect(() => c.build(c.id + id)).toThrow(/invalid/);
    }
  });

  it("keeps its fixed origin and path and encodes the id in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const expected = new URL(c.build(c.id).script.src);
    for (const id of injections) {
      const { src } = c.build(id).script;
      const url = new URL(src);
      expect(url.origin).toBe(c.origin);
      expect(url.hash).toBe("");
      expect(src).not.toMatch(/[<>"' ]/);
      expect([...url.searchParams.keys()]).toEqual([
        ...expected.searchParams.keys(),
      ]);
      expect(src).toBe(
        c.idInUrl ? expected.href.replace(c.id, encodeId(id)) : expected.href,
      );
    }
  });
});

describe("global names", () => {
  const bad = ["__proto__", "a.b", "a&b", "<s>", "1abc", "x?y", ""];
  it.each([
    [
      "PostHog",
      (globalName: string) => posthog({ apiKey: ids.posthog, globalName }),
    ],
    [
      "Segment",
      (globalName: string) => segment({ writeKey: ids.segment, globalName }),
    ],
  ])("%s validates its global name", (_name, build) => {
    for (const name of bad) expect(() => build(name)).toThrow(/invalid/);
    expect(build("myGlobal").queue.dataLayerName).toBe("myGlobal");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const name of bad)
      expect(build(name).queue.dataLayerName).not.toBe(name);
  });

  it("PostHog accepts only the us and eu regions", () => {
    expect(
      new URL(posthog({ apiKey: ids.posthog, region: "eu" }).script.src).origin,
    ).toBe("https://eu-assets.i.posthog.com");
    expect(() =>
      posthog({ apiKey: ids.posthog, region: "evil.com/" as never }),
    ).toThrow(/invalid/);
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      new URL(
        posthog({ apiKey: ids.posthog, region: "evil.com/" as never }).script
          .src,
      ).origin,
    ).toBe("https://us-assets.i.posthog.com");
  });

  it("a __proto__ global cannot pollute Object.prototype", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const target: Record<string, unknown> = {};
    posthog({ apiKey: ids.posthog, globalName: "__proto__" }).queue.install(
      target as never,
    );
    expect(({} as Record<string, unknown>).capture).toBeUndefined();
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
  });
});
