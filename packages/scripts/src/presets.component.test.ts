// @vitest-environment happy-dom
import type { ConsentState } from "@cookiechimp/core";
import { blockDynamic } from "@cookiechimp/core/dynamic";
import { gateScripts } from "@cookiechimp/core/gate";
import { afterEach, expect, it } from "vitest";
import { ga4 } from "./ga4";
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
