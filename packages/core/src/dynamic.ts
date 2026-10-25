import type { NormalizedConfig, normalizeConfig } from "./config";
import type { ConsentRuntime } from "./index";
import type { BlockedInfo } from "./internal/blocked";
import { prepareServiceFinder } from "./internal/blocker";
import { fail } from "./internal/dev";
import { imageCandidates } from "./internal/image-candidates";
import { normalizeLight } from "./internal/normalize-light";
import { acquire } from "./internal/patch";
import { isHttpUrl, resolveHttp } from "./internal/url";

export type { BlockedInfo } from "./internal/blocked";

export interface DynamicOptions {
  config: Parameters<typeof normalizeConfig>[0] | NormalizedConfig;
  document?: Document;
  onBlock?: (info: BlockedInfo) => void;
}

export interface DynamicController {
  stop(): void;
  scan(): void;
  blocked(): BlockedInfo[];
}

const noop: DynamicController = {
  stop() {},
  scan() {},
  blocked: () => [],
};
/** Block matching scripts, frames and tracking images before their requests. */
export function blockDynamic(
  consent: Pick<ConsentRuntime, "has" | "hasService" | "subscribe">,
  options: DynamicOptions,
): DynamicController {
  if (!options?.config) {
    fail("blockDynamic requires config");
    return noop;
  }
  const doc = options.document ?? globalThis.document;
  if (!doc?.defaultView) return noop;
  const win = doc.defaultView;
  const config = normalizeLight(options.config);
  const findService = prepareServiceFinder(config);
  const reports: BlockedInfo[] = [];
  const bypass = new WeakSet<Element>();
  const pixels = new Set<Element>();
  const untrusted = new WeakMap<Element, Set<string>>();
  const isPixel = (el: Element) =>
    el instanceof win.HTMLImageElement || el instanceof win.HTMLSourceElement;
  const urls = (value: string, attribute: string) =>
    attribute === "src" ? [value] : imageCandidates(value);
  let stopped = false;
  let matchWarned = false;

  const safeFind = (url: string) => {
    try {
      return findService(url, doc.baseURI);
    } catch {
      const resolved = resolveHttp(url, doc.baseURI);
      if (!resolved) return;
      if (!matchWarned) {
        matchWarned = true;
        console.warn("CookieChimp matcher failed");
      }
      return [resolved, undefined] as const;
    }
  };

  const shouldBlock = (el: Element, url: string) => {
    const { ccCategory: category, ccService: service } = (el as HTMLElement)
      .dataset;
    if (
      category &&
      !(service ? consent.hasService(service) : consent.has(category))
    )
      return { category, service };
    const result = safeFind(url);
    if (result && !result[1]) return { category, service };
    const found = result?.[1];
    return found && !consent.hasService(found.id)
      ? { category: found.category, service: found.id }
      : undefined;
  };
  const neutralise = (
    el: Element,
    value?: string,
    attribute = "src",
  ): boolean => {
    if (
      stopped ||
      bypass.has(el) ||
      !(
        el instanceof win.HTMLScriptElement ||
        el instanceof win.HTMLIFrameElement ||
        isPixel(el)
      )
    )
      return false;
    if (attribute === "srcset" && !isPixel(el)) return false;
    if (attribute === "src" && el instanceof win.HTMLSourceElement)
      return false;
    const url = value ?? el.getAttribute(attribute) ?? "";
    if (!url) return false;
    const match = urls(url, attribute)
      .map((source) => shouldBlock(el, source))
      .find(Boolean);
    if (!match) return false;
    bypass.add(el);
    el.removeAttribute(attribute);
    const data = (el as HTMLElement).dataset;
    const first = !data.ccBlocked;
    el.setAttribute(`data-cc-${attribute}`, url);
    if (isPixel(el)) {
      pixels.add(el);
      const failures = untrusted.get(el) ?? new Set<string>();
      if (!match.category && !match.service) failures.add(attribute);
      else failures.delete(attribute);
      untrusted.set(el, failures);
    }
    if (!isPixel(el)) {
      if (match.category) data.ccCategory = match.category;
      if (match.service) data.ccService = match.service;
    }
    data.ccBlocked = "true";
    if (el instanceof win.HTMLScriptElement) {
      el.dataset.ccType = el.type || "text/javascript";
      el.type = "text/plain";
    }
    bypass.delete(el);
    if (first) {
      const info: BlockedInfo = {
        url,
        ...(match.category ? { category: match.category } : {}),
        kind: isPixel(el)
          ? "image"
          : el instanceof win.HTMLScriptElement
            ? "script"
            : "iframe",
        ts: Date.now(),
        ...(match.service ? { service: match.service } : {}),
      };
      reports.push(info);
      options.onBlock?.(info);
    }
    return true;
  };
  const scanRoot = (root: ParentNode) => {
    const inspect = (el: Element) => {
      neutralise(el);
      if (isPixel(el)) neutralise(el, undefined, "srcset");
    };
    if (root instanceof win.Element) inspect(root);
    for (const el of root.querySelectorAll("script,iframe,img,picture source"))
      inspect(el);
  };

  const forget = (el: Element, attribute: string) => {
    untrusted.get(el)?.delete(attribute);
    el.removeAttribute(`data-cc-${attribute}`);
    if (!el.hasAttribute("data-cc-src") && !el.hasAttribute("data-cc-srcset")) {
      pixels.delete(el);
      el.removeAttribute("data-cc-blocked");
    }
  };
  const releases: Array<() => void> = [];
  const patchMethod = (
    target: object,
    key: PropertyKey,
    before: (self: unknown, args: unknown[]) => unknown[],
  ) => {
    releases.push(
      acquire(target, key, (descriptor) => ({
        ...descriptor,
        value: function (this: unknown, ...args: unknown[]) {
          return Reflect.apply(descriptor.value, this, before(this, args));
        },
      })),
    );
  };
  const inspectArgs = (_self: unknown, args: unknown[]) => {
    for (const arg of args) if (arg instanceof win.Element) scanRoot(arg);
    return args;
  };
  for (const [target, names] of [
    [win.Node.prototype, ["appendChild", "insertBefore", "replaceChild"]],
    [
      win.Element.prototype,
      [
        "before",
        "after",
        "replaceWith",
        "append",
        "prepend",
        "insertAdjacentElement",
      ],
    ],
  ] as const)
    for (const name of names) patchMethod(target, name, inspectArgs);
  patchMethod(win.Element.prototype, "insertAdjacentHTML", (_self, args) => {
    const html = args[1];
    if (typeof html !== "string") return args;
    const template = doc.createElement("template");
    template.innerHTML = html;
    scanRoot(template.content);
    return [args[0], template.innerHTML];
  });
  patchMethod(win.Element.prototype, "setAttribute", (self, args) => {
    const attribute = String(args[0]).toLowerCase();
    if (
      (attribute === "src" || attribute === "srcset") &&
      self instanceof win.Element &&
      neutralise(self, String(args[1]), attribute)
    )
      return [`data-cc-${attribute}`, String(args[1])];
    if (
      (attribute === "src" || attribute === "srcset") &&
      self instanceof win.Element &&
      isPixel(self) &&
      !bypass.has(self)
    )
      forget(self, attribute);
    return args;
  });
  patchMethod(win.Element.prototype, "removeAttribute", (self, args) => {
    const attribute = String(args[0]).toLowerCase();
    if (
      (attribute === "src" || attribute === "srcset") &&
      self instanceof win.Element &&
      isPixel(self) &&
      !bypass.has(self)
    )
      forget(self, attribute);
    return args;
  });
  for (const [prototype, attributes] of [
    [win.HTMLScriptElement.prototype, ["src"]],
    [win.HTMLIFrameElement.prototype, ["src"]],
    [win.HTMLImageElement.prototype, ["src", "srcset"]],
    [win.HTMLSourceElement.prototype, ["srcset"]],
  ] as const)
    for (const attribute of attributes)
      releases.push(
        acquire(prototype, attribute, (descriptor) => ({
          ...descriptor,
          set(this: Element, value: string) {
            if (!neutralise(this, String(value), attribute)) {
              if (isPixel(this)) forget(this, attribute);
              descriptor.set?.call(this, value);
            }
          },
        })),
      );

  const observer = new win.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof win.Element)
        neutralise(record.target, undefined, record.attributeName ?? "src");
      for (const node of record.addedNodes)
        if (node instanceof win.Element) scanRoot(node);
    }
  });
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "srcset"],
  });
  const unsubscribe = consent.subscribe(() => {
    if (stopped) return;
    for (const el of [...pixels]) {
      for (const attribute of ["src", "srcset"]) {
        const value = el.getAttribute(`data-cc-${attribute}`);
        if (!value || untrusted.get(el)?.has(attribute)) continue;
        const sources = urls(value, attribute);
        if (
          !sources.length ||
          sources.some(
            (url) => !isHttpUrl(url, doc.baseURI) || shouldBlock(el, url),
          )
        )
          continue;
        // Other active controllers still inspect the restoration.
        bypass.add(el);
        el.setAttribute(attribute, value);
        bypass.delete(el);
        if (el.hasAttribute(attribute)) forget(el, attribute);
      }
    }
    for (const el of doc.querySelectorAll<HTMLElement>(
      "[data-cc-blocked][data-cc-src]",
    )) {
      if (isPixel(el)) continue;
      const service = el.dataset.ccService;
      const category = el.dataset.ccCategory;
      if (
        !(service
          ? consent.hasService(service)
          : category && consent.has(category))
      )
        continue;
      const url = el.dataset.ccSrc;
      if (!url || !isHttpUrl(url, doc.baseURI)) continue;
      bypass.add(el);
      if (el instanceof win.HTMLScriptElement) {
        const fresh = doc.createElement("script");
        for (const { name, value } of [...el.attributes])
          if (!name.startsWith("data-cc-")) fresh.setAttribute(name, value);
        fresh.type = el.dataset.ccType || "text/javascript";
        fresh.src = url;
        el.replaceWith(fresh);
      } else {
        el.setAttribute("src", url);
        delete el.dataset.ccSrc;
        delete el.dataset.ccBlocked;
      }
      bypass.delete(el);
    }
  });
  scanRoot(doc);
  return {
    stop() {
      if (!stopped) {
        stopped = true;
        observer.disconnect();
        unsubscribe();
        pixels.clear();
        for (const release of releases.reverse()) release();
      }
    },
    scan() {
      if (!stopped) scanRoot(doc);
    },
    blocked: () => [...reports],
  };
}
