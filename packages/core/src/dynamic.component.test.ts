import { afterEach, describe, expect, it, vi } from "vitest";
import { blockDynamic } from "./dynamic";

function runtime() {
  const services: Record<string, boolean> = {};
  const listeners = new Set<(_state: never) => void>();
  return {
    has: () => false,
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
