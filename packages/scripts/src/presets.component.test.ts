// @vitest-environment happy-dom
import type { ConsentState } from "@cookiechimp/core";
import { blockDynamic } from "@cookiechimp/core/dynamic";
import { gateScripts } from "@cookiechimp/core/gate";
import { afterEach, expect, it, vi } from "vitest";
import { ga4 } from "./ga4";
import { gtm } from "./gtm";
import { applyPresets } from "./index";

afterEach(() => document.body.replaceChildren());

it("activates a preset descriptor only after its category is granted", async () => {
  let granted = false;
  let listener = (_state: ConsentState) => {};
  const consent = {
    has: () => granted,
    hasService: () => granted,
    subscribe: (next: (state: ConsentState) => void) => {
      listener = next;
      return () => {};
    },
  };
  const descriptor = ga4({ measurementId: "G-COMPONENT" });
  const script = document.createElement("script");
  for (const [name, value] of Object.entries(descriptor.script.attributes))
    script.setAttribute(name, value);
  document.body.append(script);
  const gate = gateScripts(consent, { document });
  expect(gate.blocked()).toHaveLength(1);
  expect(document.querySelector("script")?.getAttribute("src")).toBeNull();
  granted = true;
  listener({} as ConsentState);
  await new Promise((resolve) => setTimeout(resolve));
  expect(document.querySelector("script")?.src).toContain(
    "googletagmanager.com/gtag/js?id=G-COMPONENT",
  );
  gate.stop();
});

it("blocks dynamically inserted preset URLs until core consent is granted", async () => {
  let granted = false;
  let listener = (_state: ConsentState) => {};
  const consent = {
    has: () => granted,
    hasService: () => granted,
    subscribe: (next: (state: ConsentState) => void) => {
      listener = next;
      return () => {};
    },
  };
  const descriptor = ga4({ measurementId: "G-DYNAMIC" });
  const config = applyPresets({ categories: ["analytics"] }, [descriptor]);
  const blocker = blockDynamic(consent, { config, document });
  const script = document.createElement("script");
  script.src = descriptor.script.src;
  document.body.append(script);
  expect(script.type).toBe("text/plain");
  expect(script.getAttribute("src")).toBeNull();
  granted = true;
  listener({} as ConsentState);
  await new Promise((resolve) => setTimeout(resolve));
  expect(document.querySelector("script")?.src).toContain(
    "googletagmanager.com/gtag/js?id=G-DYNAMIC",
  );
  blocker.stop();
});

it("keeps basic GTM blocked until consent and never fetches before it", async () => {
  let granted = false;
  let listener = (_state: ConsentState) => {};
  const consent = {
    has: () => granted,
    hasService: () => granted,
    subscribe: (next: (state: ConsentState) => void) => {
      listener = next;
      return () => {};
    },
  };
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const descriptor = gtm({ containerId: "GTM-BASIC", category: "analytics" });
  descriptor.queue.install(window as never)("event", "early");
  const script = document.createElement("script");
  for (const [name, value] of Object.entries(descriptor.script.attributes))
    script.setAttribute(name, value);
  document.body.append(script);
  const gate = gateScripts(consent, { document });
  expect(document.querySelector("script")?.getAttribute("src")).toBeNull();
  expect(
    [...document.querySelectorAll("script")].some((node) =>
      /googletagmanager|google-analytics/.test(node.src),
    ),
  ).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
  granted = true;
  listener({} as ConsentState);
  await new Promise((resolve) => setTimeout(resolve));
  expect(document.querySelector("script")?.src).toBe(
    "https://www.googletagmanager.com/gtm.js?id=GTM-BASIC",
  );
  gate.stop();
  fetchSpy.mockRestore();
  delete (window as typeof window & { dataLayer?: unknown }).dataLayer;
  delete (window as typeof window & { gtag?: unknown }).gtag;
});
