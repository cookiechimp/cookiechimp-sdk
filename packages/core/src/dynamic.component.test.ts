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

  it("fails closed for setters, setAttribute, and insertion when matching throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onBlock = vi.fn();
    const controller = blockDynamic(runtime(), {
      config: {
        categories: ["analytics"],
        services: [
          {
            id: "demo",
            category: "analytics",
            domains: ["tracker.test"],
          },
        ],
      },
      onBlock,
    });
    controllers.push(controller);
    const test = RegExp.prototype.test;
    vi.spyOn(RegExp.prototype, "test").mockImplementation(function (
      this: RegExp,
      value,
    ) {
      if (this.source === "^tracker\\.test$")
        throw new Error("poisoned matcher");
      return test.call(this, value);
    });
    const frame = document.createElement("iframe");
    const script = document.createElement("script");
    const attribute = document.createElement("iframe");
    const inserted = document.createElement("script");
    frame.src = "https://tracker.test/frame";
    script.src = "https://tracker.test/script";
    attribute.setAttribute("src", "https://tracker.test/attribute");
    inserted.setAttribute("src", "https://tracker.test/inserted");
    document.body.appendChild(inserted);
    for (const element of [frame, script, attribute, inserted]) {
      expect(element.hasAttribute("src")).toBe(false);
      expect(element.dataset.ccBlocked).toBe("true");
    }
    expect(controller.blocked()).toHaveLength(4);
    expect(onBlock).toHaveBeenCalledTimes(4);
    expect(
      controller.blocked().every(({ service }) => service === undefined),
    ).toBe(true);
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

describe("tracking images", () => {
  it("intercepts detached Image src and restores it once after consent", () => {
    const setter = vi.spyOn(HTMLImageElement.prototype, "src", "set");
    const { consent, controller } = install();
    const pixel = new Image(1, 1);
    pixel.src = "https://frames.test/pixel";
    expect(setter).not.toHaveBeenCalled();
    expect(pixel.hasAttribute("src")).toBe(false);
    expect(controller.blocked()[0]).toMatchObject({
      kind: "image",
      service: "demo",
    });
    consent.allow("demo");
    expect(pixel.src).toBe("https://frames.test/pixel");
    expect(pixel.dataset.ccBlocked).toBeUndefined();
    pixel.removeAttribute("src");
    consent.allow("demo");
    expect(pixel.hasAttribute("src")).toBe(false);
  });

  it.each(["src", "srcset"])(
    "intercepts image setAttribute %s",
    (attribute) => {
      const { consent } = install();
      const image = document.createElement("img");
      const value =
        attribute === "srcset"
          ? "https://other.test/plain 1x, https://frames.test/pixel 2x"
          : "https://frames.test/pixel";
      image.setAttribute(attribute.toUpperCase(), value);
      expect(image.hasAttribute(attribute)).toBe(false);
      document.body.append(image);
      consent.allow("demo");
      expect(image.getAttribute(attribute)).toBe(value);
    },
  );

  it("rechecks every responsive candidate instead of only the first service", () => {
    const consent = runtime();
    controllers.push(
      blockDynamic(consent, {
        config: {
          categories: ["analytics"],
          services: [
            { id: "first", category: "analytics", domains: ["one.test"] },
            { id: "second", category: "analytics", domains: ["two.test"] },
          ],
        },
      }),
    );
    const image = new Image();
    image.srcset = "https://one.test/p 1x, https://two.test/p 2x";
    consent.allow("first");
    expect(image.hasAttribute("srcset")).toBe(false);
    consent.allow("second");
    expect(image.srcset).toContain("https://two.test/p");
  });

  it("does not replay a stale blocked URL after replacement or removal", () => {
    const { consent } = install();
    const replaced = new Image();
    replaced.src = "https://frames.test/stale";
    replaced.src = "https://other.test/current";
    const removed = new Image();
    removed.src = "https://frames.test/removed";
    removed.removeAttribute("src");
    consent.allow("demo");
    expect(replaced.src).toBe("https://other.test/current");
    expect(removed.hasAttribute("src")).toBe(false);
  });

  it("releases only the latest denied URL and preserves src when clearing srcset", () => {
    const { consent } = install();
    const image = new Image();
    image.src = "https://frames.test/old";
    image.src = "https://frames.test/latest";
    image.srcset = "https://frames.test/responsive 2x";
    image.removeAttribute("srcset");
    consent.allow("demo");
    expect(image.src).toBe("https://frames.test/latest");
    expect(image.hasAttribute("srcset")).toBe(false);
  });

  it("leaves nonmatching and non-HTTP images alone", () => {
    install();
    const image = new Image();
    image.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    expect(image.src).toMatch(/^data:/);
    image.src = "https://other.test/public.png";
    expect(image.src).toContain("other.test");
  });

  it("blocks picture source srcset without intercepting video src", () => {
    const { consent } = install();
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.srcset = "https://frames.test/pixel 1x";
    picture.append(source, document.createElement("img"));
    document.body.append(picture);
    expect(source.hasAttribute("srcset")).toBe(false);
    const video = document.createElement("source");
    video.src = "https://frames.test/video.mp4";
    expect(video.src).toContain("video.mp4");
    consent.allow("demo");
    expect(source.srcset).toContain("frames.test/pixel");
  });

  it("preserves native descriptors and stops retaining pending detached images", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src",
    );
    const { controller, consent } = install();
    const image = new Image();
    image.src = "https://frames.test/pending";
    controller.stop();
    expect(
      Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src"),
    ).toEqual(descriptor);
    consent.allow("demo");
    expect(image.hasAttribute("src")).toBe(false);
    image.src = "https://frames.test/native";
    expect(image.src).toContain("frames.test/native");
  });

  it("respects every active controller when restoring a detached image", () => {
    const first = install();
    const second = install();
    const image = new Image();
    image.src = "https://frames.test/pixel";
    first.consent.allow("demo");
    expect(image.hasAttribute("src")).toBe(false);
    second.consent.allow("demo");
    expect(image.src).toBe("https://frames.test/pixel");
  });
});

it("does not replay images whose original matcher failed after accept-all", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { consent } = install();
  const test = RegExp.prototype.test;
  const matcher = vi
    .spyOn(RegExp.prototype, "test")
    .mockImplementation(function (this: RegExp, value) {
      if (this.source === "^frames\\.test$") throw new Error("matcher failed");
      return test.call(this, value);
    });
  const pixel = new Image();
  pixel.src = "https://frames.test/untrusted";
  matcher.mockRestore();
  consent.allow("demo");
  expect(pixel.hasAttribute("src")).toBe(false);
  expect(warn).toHaveBeenCalledOnce();
  pixel.src = "https://frames.test/explicit-reassignment";
  expect(pixel.src).toContain("explicit-reassignment");
});
