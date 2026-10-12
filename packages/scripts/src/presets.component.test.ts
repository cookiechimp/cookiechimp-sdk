// @vitest-environment happy-dom
import type { ConsentState } from "@cookiechimp/core";
import { gateScripts } from "@cookiechimp/core/gate";
import { expect, it } from "vitest";
import { ga4 } from "./ga4";

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
