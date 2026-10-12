import { afterEach, describe, expect, it, vi } from "vitest";
import { blockDynamic } from "./dynamic";

function runtime() {
  const services: Record<string, boolean> = {};
  const categories: Record<string, boolean> = {};
  const listeners = new Set<(_state: never) => void>();
  return {
    has: (category: string) => categories[category] === true,
    hasService: (service: string) => services[service] === true,
    subscribe(fn: (_state: never) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    allow(service: string) {
      services[service] = true;
      for (const fn of listeners) fn(undefined as never);
    },
    allowCategory(category: string) {
      categories[category] = true;
      for (const fn of listeners) fn(undefined as never);
    },
  };
}
const config = {
  categories: ["analytics"],
  services: [
    {
      id: "demo",
      category: "analytics",
      scripts: ["*tracker.js"],
      domains: ["frames.test"],
    },
  ],
} as const;
const controllers: ReturnType<typeof blockDynamic>[] = [];
const install = (consent = runtime()) => {
  const controller = blockDynamic(consent, { config });
  controllers.push(controller);
  return { consent, controller };
};
const script = () => {
  const el = document.createElement("script");
  el.src = "https://cdn.test/tracker.js";
  return el;
};

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
  document.body.replaceChildren();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("dynamic insertion APIs", () => {
  it("blocks appendChild", () => {
    const el = script();
    install();
    document.body.appendChild(el);
    expect(el.type).toBe("text/plain");
  });
  it("blocks insertBefore", () => {
    const el = script();
    install();
    document.body.insertBefore(el, null);
    expect(el.type).toBe("text/plain");
  });
  it("blocks replaceChild", () => {
    const old = document.body.appendChild(document.createElement("i"));
    const el = script();
    install();
    document.body.replaceChild(el, old);
    expect(el.type).toBe("text/plain");
  });
  it("blocks before", () => {
    const old = document.body.appendChild(document.createElement("i"));
    const el = script();
    install();
    old.before(el);
    expect(el.type).toBe("text/plain");
  });
  it("blocks after", () => {
    const old = document.body.appendChild(document.createElement("i"));
    const el = script();
    install();
    old.after(el);
    expect(el.type).toBe("text/plain");
  });
  it("blocks replaceWith", () => {
    const old = document.body.appendChild(document.createElement("i"));
    const el = script();
    install();
    old.replaceWith(el);
    expect(el.type).toBe("text/plain");
  });
  it("blocks insertAdjacentElement", () => {
    const old = document.body.appendChild(document.createElement("i"));
    const el = script();
    install();
    old.insertAdjacentElement("afterend", el);
    expect(el.type).toBe("text/plain");
  });
  it("blocks insertAdjacentHTML", () => {
    install();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<script src="https://cdn.test/tracker.js"></script>',
    );
    expect(document.querySelector("script")?.type).toBe("text/plain");
  });
  it("blocks append", () => {
    const el = script();
    install();
    document.body.append(el);
    expect(el.type).toBe("text/plain");
  });
  it("blocks prepend", () => {
    const el = script();
    install();
    document.body.prepend(el);
    expect(el.type).toBe("text/plain");
  });
});

describe("dynamic src interception", () => {
  it("normalises object categories and missing service arrays", () => {
    const consent = runtime();
    const controller = blockDynamic(consent, {
      config: {
        categories: { analytics: false },
        services: [{ id: "raw", category: "analytics", domains: ["raw.test"] }],
      },
    });
    controllers.push(controller);
    const denied = document.body.appendChild(document.createElement("iframe"));
    denied.src = "https://raw.test/denied";
    expect(denied.hasAttribute("src")).toBe(false);

    consent.allow("raw");
    expect(denied.src).toBe("https://raw.test/denied");
    const allowed = document.body.appendChild(document.createElement("iframe"));
    allowed.src = "https://raw.test/allowed";
    expect(allowed.src).toBe("https://raw.test/allowed");
  });

  it("throws for invalid services in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() =>
      blockDynamic(runtime(), {
        config: { categories: ["analytics"], services: [null] } as never,
      }),
    ).toThrow("Invalid consent config for CookieChimp blocker");
  });

  it("warns and drops invalid services in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const controller = blockDynamic(runtime(), {
      config: { categories: ["analytics"], services: [null] } as never,
    });
    controllers.push(controller);
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.src = "https://raw.test/allowed";
    expect(frame.src).toBe("https://raw.test/allowed");
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each([
    { id: "bad", category: "analytics", scripts: [123] },
    { id: "bad", category: "analytics", domains: "x.com" },
    { id: "bad", category: 5 },
    { id: "bad", category: "analytics", cookies: [{}] },
  ])("rejects malformed service fields in development", (service) => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() =>
      blockDynamic(runtime(), {
        config: { categories: ["analytics"], services: [service] } as never,
      }),
    ).toThrow("Invalid consent config for CookieChimp blocker");
  });

  it("allows DOM insertion and warns once when matching throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const poisoned = /tracker/;
    const first = document.createElement("iframe");
    first.src = "https://tracker.test/frame";
    const second = document.createElement("script");
    second.src = "https://tracker.test/script";
    const controller = blockDynamic(runtime(), {
      config: {
        categories: ["analytics"],
        services: [{ id: "bad", category: "analytics", scripts: [poisoned] }],
      },
    });
    controllers.push(controller);
    poisoned.test = () => {
      throw new Error("poisoned matcher");
    };
    expect(() => document.body.append(first, second)).not.toThrow();
    expect(document.body.contains(first)).toBe(true);
    expect(document.body.contains(second)).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not call the native src setter when src is set after insertion", () => {
    const nativeSetter = vi.spyOn(HTMLIFrameElement.prototype, "src", "set");
    install();
    const frame = document.body.appendChild(document.createElement("iframe"));

    frame.src = "https://frames.test/embed";

    expect(nativeSetter).not.toHaveBeenCalled();
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.dataset.ccSrc).toBe("https://frames.test/embed");
    expect(frame.dataset.ccBlocked).toBe("true");
  });

  it("blocks the src property setter after insertion", () => {
    const { controller } = install();
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.src = "https://frames.test/embed";
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.dataset.ccSrc).toContain("frames.test/embed");
    expect(controller.blocked()[0]).toMatchObject({
      service: "demo",
      category: "analytics",
      kind: "iframe",
    });
  });

  it("blocks setAttribute src after insertion", () => {
    install();
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.setAttribute("src", "https://frames.test/embed");
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.dataset.ccSrc).toContain("frames.test/embed");
  });

  it("uses src mutation observation as a fallback", async () => {
    const { controller } = install();
    controller.stop();
    controllers.pop();
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.setAttribute("src", "https://frames.test/embed");
    const next = blockDynamic(runtime(), { config });
    controllers.push(next);
    next.scan();
    expect(frame.hasAttribute("src")).toBe(false);
  });

  it("restores a declarative block without a service after category consent", () => {
    const consent = runtime();
    install(consent);
    const frame = document.createElement("iframe");
    frame.dataset.ccCategory = "analytics";
    frame.src = "https://other.test/embed";
    document.body.append(frame);
    expect(frame.dataset.ccService).toBeUndefined();
    expect(frame.dataset.ccSrc).toBe("https://other.test/embed");
    expect(controllers.at(-1)?.blocked()[0]?.service).toBeUndefined();

    consent.allowCategory("analytics");

    expect(frame.getAttribute("src")).toBe("https://other.test/embed");
    expect(frame.dataset.ccSrc).toBeUndefined();
  });

  it.each([
    "java\nscript:alert(1)",
    "\x01javascript:alert(1)",
    "da\nta:text/html,bad",
    "java\tscript:alert(1)",
    "\tdata:text/html,bad",
  ])("does not restore a disguised non-HTTP URL %j", (source) => {
    const consent = runtime();
    install(consent);
    const frame = document.createElement("iframe");
    frame.dataset.ccCategory = "analytics";
    frame.setAttribute("src", source);
    document.body.append(frame);

    consent.allowCategory("analytics");

    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.dataset.ccSrc).toBe(source);
  });
});

describe("shared dynamic patches", () => {
  it("keeps patches active when one of two controllers stops", () => {
    const first = install().controller;
    install();
    first.stop();
    const frame = document.body.appendChild(document.createElement("iframe"));
    frame.src = "https://frames.test/embed";
    expect(frame.hasAttribute("src")).toBe(false);
  });

  it("restores exact original functions and descriptors after both controllers stop", () => {
    const append = Node.prototype.appendChild;
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      "src",
    );
    const first = install().controller;
    const second = install().controller;
    first.stop();
    second.stop();
    expect(Node.prototype.appendChild).toBe(append);
    expect(
      Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src"),
    ).toEqual(descriptor);
  });
});
