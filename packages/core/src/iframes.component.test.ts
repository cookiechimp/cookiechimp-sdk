import { afterEach, describe, expect, it, vi } from "vitest";
import { gateScripts } from "./iframes";

function runtime(categories: Record<string, boolean> = {}) {
  let state = categories;
  const listeners = new Set<(state: never) => void>();
  const services: Record<string, boolean> = {};
  return {
    has: (category: string) => state[category] === true,
    hasService: (service: string) =>
      services[service] ?? state.analytics === true,
    subscribe: (fn: (state: never) => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    set(category: string, value: boolean) {
      state = { ...state, [category]: value };
      for (const fn of listeners) fn(undefined as never);
    },
    setService(service: string, value: boolean) {
      services[service] = value;
      for (const fn of listeners) fn(undefined as never);
    },
  };
}
const controllers: ReturnType<typeof gateScripts>[] = [];
const gate = (...args: Parameters<typeof gateScripts>) => {
  const controller = gateScripts(...args);
  controllers.push(controller);
  return controller;
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("gateScripts", () => {
  it("activates inline scripts once and preserves script attributes", async () => {
    const consent = runtime({ analytics: false });
    document.body.innerHTML = `<script type="text/plain" data-cc-category="analytics" data-cc-type="module" nonce="abc" integrity="sha256-test" async defer data-extra="yes">globalThis.__gateRuns=(globalThis.__gateRuns||0)+1</script>`;
    const controller = gate(consent);
    expect(controller.blocked()).toHaveLength(1);
    consent.set("analytics", true);
    await tick();
    const script = document.querySelector("script");
    if (!script) throw new Error("activated script missing");
    expect(script.type).toBe("module");
    expect(script.getAttribute("nonce")).toBe("abc");
    expect(script.integrity).toBe("sha256-test");
    expect(script.async).toBe(true);
    expect(script.defer).toBe(true);
    expect(script.dataset.extra).toBe("yes");
    expect(script.dataset.ccActivated).toBe("true");
    expect(controller.blocked()).toEqual([]);
    consent.set("analytics", true);
    await tick();
    expect(document.querySelectorAll("[data-cc-activated]")).toHaveLength(1);
  });

  it("uses service decisions and activates ordered sources sequentially", async () => {
    const consent = runtime({ analytics: false });
    let finishFirst: (() => void) | undefined;
    const nativeAdd = HTMLScriptElement.prototype.addEventListener;
    vi.spyOn(
      HTMLScriptElement.prototype,
      "addEventListener",
    ).mockImplementation(function (
      this: HTMLScriptElement,
      type,
      listener,
      options,
    ) {
      if (type === "load" && !finishFirst) finishFirst = listener as () => void;
      else if (type !== "error") nativeAdd.call(this, type, listener, options);
    });
    document.body.innerHTML = `<script type="text/plain" data-cc-category="analytics" data-cc-service="demo" src="/one.js"></script><script type="text/plain" data-cc-category="analytics" src="/two.js"></script>`;
    gate(consent);
    await tick();
    expect(
      document.querySelector("[src='/two.js']")?.getAttribute("type"),
    ).toBe("text/plain");
    consent.set("analytics", true);
    await tick();
    const first = document.querySelector<HTMLScriptElement>("[src='/one.js']");
    if (!first) throw new Error("first script missing");
    expect(first.dataset.ccActivated).toBe("true");
    expect(
      document.querySelector("[src='/two.js']")?.getAttribute("type"),
    ).toBe("text/plain");
    finishFirst?.();
    await tick();
    expect(
      document.querySelector<HTMLScriptElement>("[src='/two.js']")?.dataset
        .ccActivated,
    ).toBe("true");
  });

  it("observes later markup and dynamically blocks matching resources", async () => {
    const consent = runtime({ analytics: false });
    const placeholder = vi.fn();
    const controller = gate(consent, {
      blockDynamic: true,
      placeholder,
      config: {
        categories: ["analytics"],
        services: [
          {
            id: "demo",
            category: "analytics",
            scripts: ["*tracker.js"],
            domains: ["frames.test"],
          },
        ],
      },
    });
    const script = document.createElement("script");
    script.src = "https://cdn.test/tracker.js";
    document.body.append(script);
    const frame = document.createElement("iframe");
    frame.src = "https://frames.test/embed";
    document.body.append(frame);
    await tick();
    expect(script.type).toBe("text/plain");
    expect(script.dataset.ccBlocked).toBe("true");
    expect(frame.dataset.ccSrc).toContain("frames.test/embed");
    expect(frame.src).toBe("about:blank");
    expect(placeholder).toHaveBeenCalledWith(frame, "analytics");
    expect(controller.blocked()).toHaveLength(2);
    consent.set("analytics", true);
    await tick();
    expect(
      document.querySelector<HTMLScriptElement>("script")?.dataset.ccActivated,
    ).toBe("true");
    expect(frame.src).toContain("frames.test/embed");
  });

  it("activates declarative frames, reports revocation, and stops observation", async () => {
    const consent = runtime({ marketing: false });
    const onRevoke = vi.fn();
    document.body.innerHTML = `<iframe data-cc-src="/frame" data-cc-category="marketing"></iframe>`;
    const controller = gate(consent, { onRevoke });
    const frame = document.querySelector<HTMLIFrameElement>("iframe");
    if (!frame) throw new Error("frame missing");
    expect(frame.hasAttribute("src")).toBe(false);
    consent.set("marketing", true);
    await tick();
    expect(frame.getAttribute("src")).toBe("/frame");
    consent.set("marketing", false);
    expect(onRevoke).toHaveBeenCalledWith("marketing", undefined);
    controller.stop();
    const late = document.createElement("iframe");
    late.dataset.ccSrc = "/late";
    late.dataset.ccCategory = "marketing";
    document.body.append(late);
    consent.set("marketing", true);
    await tick();
    expect(late.hasAttribute("src")).toBe(false);
  });
});
