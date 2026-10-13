import { afterEach, describe, expect, it, vi } from "vitest";
import { gateScripts } from "./gate";

function runtime(categories: Record<string, boolean> = {}) {
  let state = { ...categories };
  const serviceState: Record<string, boolean> = {};
  const listeners = new Set<(state: never) => void>();
  return {
    has: (category: string) => state[category] === true,
    hasService: (service: string) => serviceState[service] ?? false,
    subscribe: (listener: (state: never) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(category: string, value: boolean) {
      state = { ...state, [category]: value };
      for (const listener of listeners) listener(undefined as never);
    },
    setService(service: string, value: boolean) {
      serviceState[service] = value;
      for (const listener of listeners) listener(undefined as never);
    },
  };
}

const controllers: ReturnType<typeof gateScripts>[] = [];
function gate(...args: Parameters<typeof gateScripts>) {
  const controller = gateScripts(...args);
  controllers.push(controller);
  return controller;
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("gateScripts script activation", () => {
  it("copies nonce, integrity, async, defer, crossorigin, referrerpolicy, data attributes, and module type", async () => {
    const consent = runtime({ analytics: false });
    document.body.innerHTML = `<script type="text/plain" data-cc-category="analytics" data-cc-type="module" data-owner="chimp" nonce="abc" integrity="sha256-test" async defer crossorigin="anonymous" referrerpolicy="no-referrer"></script>`;
    gate(consent);

    consent.set("analytics", true);
    await tick();

    const script = document.querySelector<HTMLScriptElement>("script");
    expect(script).not.toBeNull();
    expect(script?.type).toBe("module");
    expect(script?.getAttribute("nonce")).toBe("abc");
    expect(script?.integrity).toBe("sha256-test");
    expect(script?.async).toBe(true);
    expect(script?.defer).toBe(true);
    expect(script?.crossOrigin).toBe("anonymous");
    expect(script?.referrerPolicy).toBe("no-referrer");
    expect(script?.dataset.owner).toBe("chimp");
  });

  it("loads ordered source scripts sequentially and keeps intervening inline scripts in document order", async () => {
    const consent = runtime({ analytics: false });
    const loadCallbacks: Array<() => void> = [];
    vi.spyOn(
      HTMLScriptElement.prototype,
      "addEventListener",
    ).mockImplementation(function (this: HTMLScriptElement, type, listener) {
      if (type === "load") loadCallbacks.push(listener as () => void);
    });
    document.body.innerHTML = [
      '<script id="first" type="text/plain" data-cc-category="analytics" src="/first.js"></script>',
      '<script id="inline" type="text/plain" data-cc-category="analytics">window.inline = true</script>',
      '<script id="last" type="text/plain" data-cc-category="analytics" src="/last.js"></script>',
    ].join("");
    gate(consent);

    consent.set("analytics", true);
    await tick();
    expect(
      document.querySelector("#first")?.getAttribute("data-cc-activated"),
    ).toBe("true");
    expect(document.querySelector("#inline")?.getAttribute("type")).toBe(
      "text/plain",
    );
    expect(document.querySelector("#last")?.getAttribute("type")).toBe(
      "text/plain",
    );

    loadCallbacks[0]?.();
    await tick();
    expect(
      document.querySelector("#inline")?.getAttribute("data-cc-activated"),
    ).toBe("true");
    expect(
      document.querySelector("#last")?.getAttribute("data-cc-activated"),
    ).toBe("true");
  });

  it("activates late-added scripts when consent is granted and leaves them pending when it is not", async () => {
    const consent = runtime({ analytics: false });
    const controller = gate(consent);
    const waiting = document.createElement("script");
    waiting.type = "text/plain";
    waiting.dataset.ccCategory = "analytics";
    document.body.append(waiting);
    await tick();
    expect(controller.blocked().map(({ el }) => el)).toContain(waiting);

    consent.set("analytics", true);
    await tick();
    const allowed = document.createElement("script");
    allowed.type = "text/plain";
    allowed.dataset.ccCategory = "analytics";
    document.body.append(allowed);
    await tick();
    expect(allowed.isConnected).toBe(false);
    expect(
      document.querySelectorAll("[data-cc-activated='true']"),
    ).toHaveLength(2);
  });

  it("runs each script only once across repeated consent changes and scans", async () => {
    const consent = runtime({ analytics: false });
    document.body.innerHTML =
      '<script type="text/plain" data-cc-category="analytics"></script>';
    const replace = vi.spyOn(Element.prototype, "replaceWith");
    const controller = gate(consent);
    consent.set("analytics", true);
    await tick();
    consent.set("analytics", true);
    controller.scan();
    controller.scan();
    await tick();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe("gateScripts revocation and controller", () => {
  it("reports one revoke across later unrelated consent changes", async () => {
    const consent = runtime({ analytics: false, marketing: false });
    const onRevoke = vi.fn();
    document.body.innerHTML =
      '<iframe srcdoc="" data-cc-src="/first" data-cc-category="analytics"></iframe>';
    gate(consent, { onRevoke });
    consent.set("analytics", true);
    await tick();
    consent.set("analytics", false);
    consent.set("marketing", true);
    consent.set("marketing", false);
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("cancels scripts waiting in the ordered activation chain on stop", async () => {
    const consent = runtime({ analytics: false });
    const callbacks: Array<() => void> = [];
    vi.spyOn(
      HTMLScriptElement.prototype,
      "addEventListener",
    ).mockImplementation((_type, listener) => {
      callbacks.push(listener as () => void);
    });
    document.body.innerHTML =
      '<script id="one" type="text/plain" data-cc-category="analytics" src="/one.js"></script><script id="two" type="text/plain" data-cc-category="analytics" src="/two.js"></script>';
    const controller = gate(consent);
    consent.set("analytics", true);
    await tick();
    controller.stop();
    callbacks[0]?.();
    await tick();
    expect(document.querySelector("#two")?.getAttribute("type")).toBe(
      "text/plain",
    );
  });

  it("calls onRevoke with the affected category, reloads only when configured", async () => {
    const reload = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => {});
    const firstConsent = runtime({ analytics: false });
    const firstRevoke = vi.fn();
    document.body.innerHTML =
      '<iframe srcdoc="" data-cc-src="/first" data-cc-category="analytics"></iframe>';
    gate(firstConsent, { onRevoke: firstRevoke, reloadOnRevoke: false });
    firstConsent.set("analytics", true);
    await tick();
    firstConsent.set("analytics", false);
    expect(firstRevoke).toHaveBeenCalledWith("analytics", undefined);
    expect(reload).not.toHaveBeenCalled();

    document.body.innerHTML =
      '<iframe srcdoc="" data-cc-src="/second" data-cc-category="marketing"></iframe>';
    const secondConsent = runtime({ marketing: false });
    gate(secondConsent, { reloadOnRevoke: true });
    secondConsent.set("marketing", true);
    await tick();
    secondConsent.set("marketing", false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("stop disconnects automatic work, while scan finds missed elements and blocked reports exact pending metadata", async () => {
    const consent = runtime({ analytics: false, marketing: false });
    const controller = gate(consent);
    controller.stop();
    const script = document.createElement("script");
    script.type = "text/plain";
    script.dataset.ccCategory = "analytics";
    script.dataset.ccService = "stats";
    const frame = document.createElement("iframe");
    frame.srcdoc = "";
    frame.dataset.ccSrc = "/ad";
    frame.dataset.ccCategory = "marketing";
    document.body.append(script, frame);
    consent.setService("stats", true);
    consent.set("marketing", true);
    await tick();
    expect(script.isConnected).toBe(true);
    expect(frame.hasAttribute("src")).toBe(false);

    consent.setService("stats", false);
    consent.set("marketing", false);
    controller.scan();
    expect(controller.blocked()).toEqual([
      { el: script, category: "analytics", service: "stats" },
      { el: frame, category: "marketing" },
    ]);
  });
});

describe("gateScripts URL safety", () => {
  it.each([
    "java\nscript:alert(1)",
    "\x01javascript:alert(1)",
    "da\nta:text/html,bad",
    "java\tscript:alert(1)",
    "\tdata:text/html,bad",
  ])(
    "never activates a disguised non-HTTP data-cc-src value %j",
    async (source) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consent = runtime({ analytics: true });
      const script = document.createElement("script");
      script.type = "text/plain";
      script.dataset.ccCategory = "analytics";
      script.dataset.ccSrc = source;
      const frame = document.createElement("iframe");
      frame.dataset.ccCategory = "analytics";
      frame.dataset.ccSrc = source;
      document.body.append(script, frame);
      const controller = gate(consent);
      await tick();
      expect(controller.blocked()).toHaveLength(2);
      expect(frame.hasAttribute("src")).toBe(false);
      expect(warn).toHaveBeenCalledTimes(2);
    },
  );

  it("warns when data-cc-category is combined with plain src", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML =
      '<iframe data-cc-category="analytics" src="/too-early"></iframe>';
    gate(runtime());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("plain src"));
  });
});

describe("gateScripts iframe activation", () => {
  it("activates category and service frames, calls placeholders only while blocked", async () => {
    const consent = runtime({ marketing: false });
    const placeholder = vi.fn();
    document.body.innerHTML = [
      '<iframe srcdoc="" id="category" data-cc-src="/category" data-cc-category="marketing"></iframe>',
      '<iframe srcdoc="" id="service" data-cc-src="/service" data-cc-category="marketing" data-cc-service="video"></iframe>',
    ].join("");
    gate(consent, { placeholder });
    const category = document.querySelector<HTMLIFrameElement>("#category");
    const service = document.querySelector<HTMLIFrameElement>("#service");
    if (!category || !service) throw new Error("test frames missing");
    expect(placeholder).toHaveBeenCalledWith(category, "marketing");
    expect(placeholder).toHaveBeenCalledWith(service, "marketing");

    consent.set("marketing", true);
    await tick();
    expect(category.getAttribute("src")).toBe("/category");
    expect(service.hasAttribute("src")).toBe(false);
    consent.setService("video", true);
    await tick();
    expect(service.getAttribute("src")).toBe("/service");

    placeholder.mockClear();
    const late = document.createElement("iframe");
    late.srcdoc = "";
    late.dataset.ccSrc = "/late";
    late.dataset.ccCategory = "marketing";
    document.body.append(late);
    await tick();
    expect(late.getAttribute("src")).toBe("/late");
    expect(placeholder).not.toHaveBeenCalled();
  });
});

it("claims retained scripts only once across controllers, scans and restarts", async () => {
  const consent = runtime({ analytics: true });
  document.body.innerHTML =
    '<script type="text/plain" data-cc-category="analytics" data-cc-keep="true" nonce="safe"></script>';
  const inert = document.querySelector("script");
  const first = gate(consent);
  const second = gate(consent);
  await tick();
  first.scan();
  second.scan();
  first.stop();
  gate(consent);
  await tick();
  expect(inert?.isConnected).toBe(true);
  expect(document.querySelectorAll('[data-cc-activated="true"]')).toHaveLength(
    1,
  );
  expect(
    document.querySelector('[data-cc-activated="true"]')?.getAttribute("nonce"),
  ).toBe("safe");
});

it("rechecks queued consent and can retry a cancelled activation", async () => {
  const consent = runtime({ analytics: true });
  document.body.innerHTML =
    '<script type="text/plain" data-cc-category="analytics" data-cc-keep="true"></script>';
  const first = gate(consent);
  first.stop();
  gate(consent);
  consent.set("analytics", false);
  await tick();
  expect(document.querySelector('[data-cc-activated="true"]')).toBeNull();
  consent.set("analytics", true);
  await tick();
  expect(document.querySelectorAll('[data-cc-activated="true"]')).toHaveLength(
    1,
  );
});

it("preserves external and inline ordering across multiple gate controllers", async () => {
  const consent = runtime({ analytics: true });
  const loaded: Array<() => void> = [];
  vi.spyOn(HTMLScriptElement.prototype, "addEventListener").mockImplementation(
    (type, listener) => {
      if (type === "load") loaded.push(listener as () => void);
    },
  );
  document.body.innerHTML =
    '<script type="text/plain" data-cc-keep="true" data-cc-category="analytics" data-cc-src="/first.js"></script><script type="text/plain" data-cc-keep="true" data-cc-category="analytics">window.second = true;</script>';
  gate(consent);
  gate(consent);
  await tick();
  expect(document.querySelectorAll('[data-cc-activated="true"]')).toHaveLength(
    1,
  );
  loaded[0]?.();
  await tick();
  expect(document.querySelectorAll('[data-cc-activated="true"]')).toHaveLength(
    2,
  );
});
