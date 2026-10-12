import { consentModeDefault } from "@cookiechimp/core/consent-mode";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ga4 } from "./ga4";
import { googleAds } from "./google-ads";
import { gtm } from "./gtm";
import { applyPresets, type ScriptPreset } from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const all = (): ScriptPreset[] => [
  ga4({ measurementId: "G-NET" }),
  gtm({ containerId: "GTM-NET", category: "analytics" }),
  gtm({
    containerId: "GTM-ADV",
    category: "analytics",
    consentMode: "advanced",
  }),
  googleAds({ conversionId: "AW-NET" }),
];

describe("pre-consent stubs", () => {
  it("queue calls without any network or DOM access", () => {
    const fetch = vi.fn();
    const beacon = vi.fn();
    const XMLHttpRequest = vi.fn();
    const Image = vi.fn();
    const createElement = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("XMLHttpRequest", XMLHttpRequest);
    vi.stubGlobal("Image", Image);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.stubGlobal("document", { createElement });
    for (const preset of all()) {
      const target: Record<string, unknown> = {};
      const gtag = preset.queue.install(target as never);
      gtag("config", "X");
      gtag("event", "purchase", { value: 1 });
      const layer = target[preset.queue.dataLayerName] as unknown[];
      expect(layer.length).toBeGreaterThan(0);
    }
    for (const spy of [fetch, beacon, XMLHttpRequest, Image, createElement])
      expect(spy).not.toHaveBeenCalled();
  });

  it("gated presets ship inert script markup with no src", () => {
    for (const preset of all().filter(({ load }) => load === "gated")) {
      expect(preset.script.attributes.type).toBe("text/plain");
      expect(preset.script.attributes.src).toBeUndefined();
      expect(preset.script.attributes["data-cc-src"]).toBe(preset.script.src);
    }
  });
});

describe("Google Ads defaults", () => {
  it("are always denied and match core's Consent Mode default", () => {
    const config = applyPresets({ categories: ["analytics", "marketing"] }, [
      googleAds({ conversionId: "AW-1" }),
    ]);
    const defaults = consentModeDefault(config.consentMode);
    expect(defaults).toMatchObject({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    expect(config.consentMode.mapping?.marketing).toEqual([
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
    ]);
    expect(config.consentMode.mapping?.analytics).toBeUndefined();
  });

  it("advanced GTM queues exactly core's denied default", () => {
    const target: Record<string, unknown> = {};
    gtm({
      containerId: "GTM-A",
      category: "analytics",
      consentMode: "advanced",
    }).queue.install(target as never);
    const first = Array.from(
      (target.dataLayer as ArrayLike<unknown>[])[0] as ArrayLike<unknown>,
    );
    expect(first.slice(0, 2)).toEqual(["consent", "default"]);
    expect(first[2]).toEqual(consentModeDefault());
  });
});

describe("GTM modes", () => {
  it("basic mode is gated and sets no defaults of its own", () => {
    const basic = gtm({ containerId: "GTM-B", category: "analytics" });
    expect(basic.load).toBe("gated");
    const target: Record<string, unknown> = {};
    basic.queue.install(target as never);
    expect(target.dataLayer).toEqual([]);
  });

  it("advanced mode loads immediately with denied defaults queued first", () => {
    const advanced = gtm({
      containerId: "GTM-A",
      category: "analytics",
      consentMode: "advanced",
    });
    expect(advanced.load).toBe("immediate");
    expect(advanced.script.attributes.src).toBe(
      "https://www.googletagmanager.com/gtm.js?id=GTM-A",
    );
    const target: Record<string, unknown> = {};
    advanced.queue.install(target as never)("event", "early");
    const layer = (target.dataLayer as ArrayLike<unknown>[]).map((entry) =>
      Array.from(entry),
    );
    expect(layer[0]?.[1]).toBe("default");
    expect(layer[1]).toEqual(["event", "early"]);
  });
});

const injections = [
  'G-1"onload="x',
  "G-1'><script>alert(1)</script>",
  "<script>",
  "G-1/../../evil",
  "G-1?id=x&l=evil",
  "//evil.com",
  "https://evil.com/x.js",
  "G-1#frag",
  "G-1 ",
  "g-abc",
  "",
];
const builders: [string, string, (id: string) => ScriptPreset][] = [
  ["GA4", "G-", (id) => ga4({ measurementId: id })],
  ["GTM", "GTM-", (id) => gtm({ containerId: id, category: "analytics" })],
  ["Google Ads", "AW-", (id) => googleAds({ conversionId: id })],
];

describe("id validation and URL safety", () => {
  it.each(builders)(
    "%s accepts only its strict prefix",
    (_n, prefix, build) => {
      expect(() => build(`${prefix}ABC123`)).not.toThrow();
      for (const other of ["G-", "GTM-", "AW-"].filter((p) => p !== prefix))
        expect(() => build(`${other}ABC123`)).toThrow(/invalid/);
    },
  );

  it.each(builders)(
    "%s rejects injection attempts in development",
    (_n, prefix, build) => {
      for (const id of injections) {
        expect(() => build(id)).toThrow(/invalid/);
        expect(() => build(prefix + id.replace(/^G-1/, "1"))).toThrow(
          /invalid/,
        );
      }
    },
  );

  it.each(builders)(
    "%s keeps a fixed Google origin and an encoded id in production",
    (_n, _prefix, build) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      for (const id of injections) {
        const { src, attributes } = build(id).script;
        const url = new URL(src);
        expect(url.origin).toBe("https://www.googletagmanager.com");
        expect(["/gtag/js", "/gtm.js"]).toContain(url.pathname);
        expect(url.hash).toBe("");
        expect([...url.searchParams.keys()]).toEqual(["id"]);
        expect(url.searchParams.get("id")).toBe(id);
        expect(src).not.toMatch(/[<>"' ]/);
        expect(attributes["data-cc-src"] ?? attributes.src).toBe(src);
      }
    },
  );

  it("validates the GTM data layer name", () => {
    for (const name of ["a&b", "x?y", "__proto__", "<s>", "1abc", "a.b"])
      expect(() =>
        gtm({
          containerId: "GTM-X",
          category: "analytics",
          dataLayerName: name,
        }),
      ).toThrow(/invalid/);
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const preset = gtm({
      containerId: "GTM-X",
      category: "analytics",
      dataLayerName: "a&l=evil",
    });
    expect(preset.script.src).toBe(
      "https://www.googletagmanager.com/gtm.js?id=GTM-X",
    );
    expect(preset.queue.dataLayerName).toBe("dataLayer");
    expect(
      gtm({
        containerId: "GTM-X",
        category: "analytics",
        dataLayerName: "myLayer",
      }).script.src,
    ).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-X&l=myLayer");
  });
});
