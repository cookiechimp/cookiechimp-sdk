// @vitest-environment happy-dom
import type { ConsentState } from "@cookiechimp/core";
import { gateScripts } from "@cookiechimp/core/gate";
import { afterEach, expect, it, vi } from "vitest";
import { clarity } from "./clarity";
import { hotjar } from "./hotjar";
import type { ScriptPreset } from "./index";
import { linkedin } from "./linkedin";
import { metaPixel } from "./meta-pixel";
import { posthog } from "./posthog";
import { segment } from "./segment";
import { tiktok } from "./tiktok";

const globals = [
  "fbq",
  "_fbq",
  "clarity",
  "posthog",
  "analytics",
  "hj",
  "_hjSettings",
  "lintrk",
  "_linkedin_data_partner_ids",
  "ttq",
];
afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  for (const name of globals)
    delete (window as never as Record<string, unknown>)[name];
  vi.restoreAllMocks();
});

const presets = (): ScriptPreset[] => [
  metaPixel({ pixelId: "123456789012345" }),
  clarity({ projectId: "abcde12345" }),
  posthog({ apiKey: "phc_abcdefghijklmnopqrstuvwxyz0123456789ABC" }),
  segment({ writeKey: "abcdefghijABCDEFGHIJ0123456789ab" }),
  hotjar({ siteId: "1234567" }),
  linkedin({ partnerId: "123456" }),
  tiktok({ pixelId: "C4ABCDEFGHIJ12345678" }),
];
const vendorHosts =
  /facebook|clarity\.ms|posthog|segment|hotjar|licdn|linkedin|tiktok/;
const loaded = () =>
  [...document.querySelectorAll("script")]
    .map((node) => node.getAttribute("src") ?? "")
    .filter((src) => vendorHosts.test(src));

it("gates every vendor by category and starts no request before consent", async () => {
  const granted: Record<string, boolean> = {};
  let listener = (_state: ConsentState) => {};
  const consent = {
    has: (category: string) => granted[category] === true,
    hasService: (service: string) =>
      granted[categoryOf[service] ?? ""] === true,
    subscribe: (next: (state: ConsentState) => void) => {
      listener = next;
      return () => {};
    },
  };
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const beacon = vi.spyOn(navigator, "sendBeacon");
  const all = presets();
  const categoryOf: Record<string, string> = Object.fromEntries(
    all.map((preset) => [preset.id, preset.category]),
  );
  for (const preset of all) {
    preset.queue.install(window as never)("track", "early");
    const script = document.createElement("script");
    for (const [name, value] of Object.entries(preset.script.attributes))
      script.setAttribute(name, value);
    document.head.append(script);
  }
  const gate = gateScripts(consent, { document });
  expect(gate.blocked()).toHaveLength(all.length);
  expect(loaded()).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(beacon).not.toHaveBeenCalled();

  granted.analytics = true;
  listener({} as ConsentState);
  await new Promise((resolve) => setTimeout(resolve));
  const analytics = loaded();
  expect(
    analytics.some((src) => src.includes("clarity.ms/tag/abcde12345")),
  ).toBe(true);
  expect(analytics.some((src) => src.includes("posthog.com"))).toBe(true);
  expect(analytics.some((src) => src.includes("cdn.segment.com"))).toBe(true);
  expect(analytics.some((src) => src.includes("hotjar-1234567"))).toBe(true);
  expect(analytics.some((src) => /facebook|licdn|tiktok/.test(src))).toBe(
    false,
  );

  granted.marketing = true;
  listener({} as ConsentState);
  await new Promise((resolve) => setTimeout(resolve));
  expect(loaded()).toHaveLength(all.length);
  gate.stop();
});
