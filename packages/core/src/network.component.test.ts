import { afterEach, describe, expect, it, vi } from "vitest";
import { blockDynamic } from "./dynamic";
import { blockNetwork, ConsentBlockedError } from "./network";

const config = {
  categories: ["analytics"],
  services: [
    { id: "tracker", category: "analytics", domains: ["tracker.test"] },
  ],
} as const;

const controllers: ReturnType<typeof blockNetwork>[] = [];
function runtime(allowed = false) {
  return {
    hasService: vi.fn(() => allowed),
    set(value: boolean) {
      allowed = value;
    },
  };
}
function install(consent = runtime(), onBlock?: (value: unknown) => void) {
  const controller = blockNetwork(consent, { config, window, onBlock });
  controllers.push(controller);
  return { consent, controller };
}

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("network blocker", () => {
  it("normalises object categories and missing service arrays", async () => {
    const native = vi.spyOn(window, "fetch").mockResolvedValue(new Response());
    const consent = runtime();
    const controller = blockNetwork(consent, {
      config: {
        categories: { analytics: false },
        services: [{ id: "raw", category: "analytics", domains: ["raw.test"] }],
      },
      window,
    });
    controllers.push(controller);
    await expect(window.fetch("https://raw.test/denied")).rejects.toThrow();
    consent.set(true);
    await window.fetch("https://raw.test/allowed");
    expect(native).toHaveBeenCalledOnce();
  });

  it("throws for invalid services in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() =>
      blockNetwork(runtime(), {
        config: { categories: ["analytics"], services: [null] } as never,
        window,
      }),
    ).toThrow("Invalid consent config for CookieChimp blocker");
  });

  it("warns and drops invalid services in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const native = vi.spyOn(window, "fetch").mockResolvedValue(new Response());
    const controller = blockNetwork(runtime(), {
      config: { categories: ["analytics"], services: [null] } as never,
      window,
    });
    controllers.push(controller);
    await window.fetch("https://raw.test/allowed");
    expect(native).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each([
    "https://tracker.test/collect",
    new URL("https://tracker.test/collect"),
    new Request("https://tracker.test/collect"),
  ])("blocks fetch input %s without calling native", async (input) => {
    const native = vi.fn(window.fetch);
    window.fetch = native;
    const onBlock = vi.fn();
    const { controller } = install(runtime(), onBlock);
    await expect(window.fetch(input)).rejects.toBeInstanceOf(
      ConsentBlockedError,
    );
    expect(native).not.toHaveBeenCalled();
    expect(onBlock).toHaveBeenCalledOnce();
    expect(controller.blocked()).toHaveLength(1);
  });

  it("resolves relative URLs and ignores non-HTTP and malformed inputs", async () => {
    const native = vi.spyOn(window, "fetch").mockResolvedValue(new Response());
    install();
    await window.fetch("/local");
    await window.fetch("data:text/plain,ok");
    expect(native).toHaveBeenCalledTimes(2);
  });

  it("reads consent live across grant and revoke", async () => {
    const native = vi.spyOn(window, "fetch").mockResolvedValue(new Response());
    const consent = runtime();
    install(consent);
    await expect(window.fetch("https://tracker.test/a")).rejects.toThrow();
    consent.set(true);
    await window.fetch("https://tracker.test/b");
    consent.set(false);
    await expect(window.fetch("https://tracker.test/c")).rejects.toThrow();
    expect(native).toHaveBeenCalledOnce();
  });

  it("blocks XHR send and emits readystatechange, error, loadend asynchronously", async () => {
    const send = vi.spyOn(window.XMLHttpRequest.prototype, "send");
    install();
    const xhr = new window.XMLHttpRequest();
    const events: string[] = [];
    const states: number[] = [];
    xhr.addEventListener("readystatechange", () => {
      events.push("readystatechange");
      states.push(xhr.readyState);
    });
    xhr.addEventListener("error", (event) => {
      events.push("error");
      expect(event).toBeInstanceOf(window.ProgressEvent);
    });
    xhr.addEventListener("loadend", () => events.push("loadend"));
    xhr.open("POST", "https://tracker.test/xhr");
    xhr.send();
    expect(send).not.toHaveBeenCalled();
    expect(xhr.readyState).toBe(4);
    expect(xhr.status).toBe(0);
    expect(events).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["readystatechange", "error", "loadend"]);
    expect(states).toEqual([4]);
  });

  it("allows XHR with consent", () => {
    const send = vi
      .spyOn(window.XMLHttpRequest.prototype, "send")
      .mockImplementation(() => {});
    install(runtime(true));
    const xhr = new window.XMLHttpRequest();
    xhr.open("GET", "https://tracker.test/xhr");
    xhr.send();
    expect(send).toHaveBeenCalledOnce();
  });

  it("rejects blocked fetch with a TypeError subclass", async () => {
    install();
    await expect(
      window.fetch("https://tracker.test/collect"),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("blocks and allows beacon", () => {
    const original = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      "sendBeacon",
    );
    const native = vi.fn(() => true);
    Object.defineProperty(Navigator.prototype, "sendBeacon", {
      configurable: true,
      writable: true,
      value: native,
    });
    const denied = install().controller;
    expect(navigator.sendBeacon("https://tracker.test/beacon")).toBe(false);
    expect(native).not.toHaveBeenCalled();
    denied.stop();
    const allowed = install(runtime(true)).controller;
    expect(navigator.sendBeacon("https://tracker.test/beacon")).toBe(true);
    expect(native).toHaveBeenCalledOnce();
    allowed.stop();
    if (original)
      Object.defineProperty(Navigator.prototype, "sendBeacon", original);
    else delete (Navigator.prototype as Partial<Navigator>).sendBeacon;
  });

  it("reference counts controllers and restores exact originals", () => {
    const fetch = window.fetch;
    const first = install().controller;
    const second = install().controller;
    first.stop();
    expect(window.fetch).not.toBe(fetch);
    second.stop();
    expect(window.fetch).toBe(fetch);
  });

  it("coexists with the dynamic blocker", () => {
    const live = runtime();
    const dynamic = blockDynamic(
      { ...live, has: () => false, subscribe: () => () => {} },
      { config },
    );
    const network = install(live).controller;
    network.stop();
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.src = "https://tracker.test/embed";
    expect(frame.hasAttribute("src")).toBe(false);
    dynamic.stop();
    frame.remove();
  });
});
