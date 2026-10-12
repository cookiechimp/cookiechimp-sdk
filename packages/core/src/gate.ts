import type { ConsentRuntime } from "./index";
import { isHttpUrl } from "./internal/url";

export interface GateOptions {
  onRevoke?: (category: string, service?: string) => void;
  reloadOnRevoke?: boolean;
  placeholder?: (iframe: HTMLIFrameElement, category: string) => void;
  document?: Document;
}

export interface BlockedElement {
  el: HTMLScriptElement | HTMLIFrameElement;
  category: string;
  service?: string;
}

export interface GateController {
  stop(): void;
  scan(): void;
  blocked(): BlockedElement[];
}

const noop = (): GateController => ({
  stop() {},
  scan() {},
  blocked: () => [],
});
const isDevelopment = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function invalid(message: string): void {
  if (isDevelopment())
    throw new TypeError(`Invalid gateScripts options: ${message}`);
  console.warn(`CookieChimp ignored invalid gateScripts options: ${message}`);
}

function warn(message: string): void {
  if (isDevelopment()) console.warn(`CookieChimp gate: ${message}`);
}

/**
 * Activate declaratively gated resources. Third-party code that assigns a plain
 * src needs `@cookiechimp/core/dynamic`, which intercepts the assignment before
 * the browser can request it.
 */
export function gateScripts(
  consent: Pick<ConsentRuntime, "has" | "hasService" | "subscribe">,
  options: GateOptions = {},
): GateController {
  if (
    !consent ||
    typeof consent.has !== "function" ||
    typeof consent.hasService !== "function" ||
    typeof consent.subscribe !== "function"
  ) {
    invalid("consent must provide has, hasService, and subscribe");
    return noop();
  }
  for (const key of ["placeholder", "onRevoke"] as const) {
    if (options[key] !== undefined && typeof options[key] !== "function") {
      invalid(`${key} must be a function`);
      options = { ...options, [key]: undefined };
    }
  }
  const doc = options.document ?? globalThis.document;
  if (!doc) return noop();
  let stopped = false;
  const done = new WeakSet<Element>();
  const pending = new Map<Element, BlockedElement>();
  const granted = new Map<string, boolean>();
  let ordered = Promise.resolve();
  const allowed = (category: string, service?: string) =>
    service ? consent.hasService(service) : consent.has(category);
  const keyFor = (category: string, service?: string) =>
    `${category}\0${service ?? ""}`;

  const script = (el: HTMLScriptElement) => {
    if (done.has(el) || el.type !== "text/plain") return;
    const category = el.dataset.ccCategory;
    if (!category) return;
    const service = el.dataset.ccService;
    if (!allowed(category, service)) {
      pending.set(el, { el, category, ...(service ? { service } : {}) });
      return;
    }
    const source = el.dataset.ccSrc ?? el.getAttribute("src") ?? "";
    if (source && !isHttpUrl(source, doc.baseURI)) {
      warn(`refused unsafe data-cc-src ${JSON.stringify(source)}`);
      pending.set(el, { el, category, ...(service ? { service } : {}) });
      return;
    }
    done.add(el);
    pending.delete(el);
    granted.set(keyFor(category, service), true);
    const activate = () =>
      new Promise<void>((resolve) => {
        if (stopped || !el.isConnected) return resolve();
        const fresh = doc.createElement("script");
        for (const { name, value } of [...el.attributes]) {
          if (
            ![
              "type",
              "src",
              "data-cc-src",
              "data-cc-blocked",
              "data-cc-type",
            ].includes(name)
          )
            fresh.setAttribute(name, value);
        }
        fresh.type = el.dataset.ccType || "text/javascript";
        fresh.textContent = el.textContent;
        fresh.dataset.ccActivated = "true";
        const async = el.hasAttribute("async");
        if (!async) fresh.async = false;
        if (source) fresh.src = source;
        if (source && !async) {
          fresh.addEventListener("load", () => resolve(), { once: true });
          fresh.addEventListener("error", () => resolve(), { once: true });
        } else resolve();
        if (stopped) return resolve();
        el.replaceWith(fresh);
      });
    if (source && el.hasAttribute("async")) void activate();
    else ordered = ordered.then(activate);
  };

  const frame = (el: HTMLIFrameElement) => {
    if (done.has(el)) return;
    const category = el.dataset.ccCategory;
    const source = el.dataset.ccSrc;
    if (!category || !source) return;
    const service = el.dataset.ccService;
    if (!allowed(category, service)) {
      pending.set(el, { el, category, ...(service ? { service } : {}) });
      options.placeholder?.(el, category);
      return;
    }
    if (!isHttpUrl(source, doc.baseURI)) {
      warn(`refused unsafe data-cc-src ${JSON.stringify(source)}`);
      pending.set(el, { el, category, ...(service ? { service } : {}) });
      return;
    }
    done.add(el);
    pending.delete(el);
    granted.set(keyFor(category, service), true);
    el.src = source;
    delete el.dataset.ccSrc;
    delete el.dataset.ccBlocked;
  };

  const process = (root: ParentNode) => {
    const elements: Element[] = root instanceof Element ? [root] : [];
    elements.push(...root.querySelectorAll("script,iframe"));
    for (const el of elements) {
      if (
        el.hasAttribute("data-cc-category") &&
        el.hasAttribute("src") &&
        !(el instanceof HTMLScriptElement && el.type === "text/plain")
      ) {
        warn(
          "data-cc-category was used with plain src; use data-cc-src to prevent pre-consent loading",
        );
      }
      if (el instanceof HTMLScriptElement) script(el);
      else if (el instanceof HTMLIFrameElement) frame(el);
    }
  };
  const scan = () => process(doc);
  scan();
  const Observer = doc.defaultView?.MutationObserver;
  const observer = Observer
    ? new Observer((records) => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof Element)
            process(record.target);
          for (const node of record.addedNodes)
            if (node instanceof Element) process(node);
        }
      })
    : undefined;
  observer?.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  const unsubscribe = consent.subscribe(() => {
    if (stopped) return;
    for (const [key, wasGranted] of granted) {
      const [category = "", service = ""] = key.split("\0");
      if (wasGranted && !allowed(category, service || undefined)) {
        granted.set(key, false);
        options.onRevoke?.(category, service || undefined);
        if (options.reloadOnRevoke) doc.defaultView?.location.reload();
      }
    }
    scan();
  });
  return {
    stop() {
      if (!stopped) {
        stopped = true;
        observer?.disconnect();
        unsubscribe();
      }
    },
    scan,
    blocked: () => [...pending.values()],
  };
}
