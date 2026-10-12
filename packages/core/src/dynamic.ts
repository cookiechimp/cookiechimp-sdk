import type { NormalizedConfig, normalizeConfig } from "./config";
import type { ConsentRuntime } from "./index";
import type { BlockedInfo } from "./internal/blocked";
import { normalizeLight } from "./internal/normalize-light";
import { acquire } from "./internal/patch";
import { isHttpUrl } from "./internal/url";
import { matchService } from "./match";

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

const noop = (): DynamicController => ({
  stop() {},
  scan() {},
  blocked: () => [],
});
/** Block matching scripts and frames before a browser can start their request. */
export function blockDynamic(
  consent: Pick<ConsentRuntime, "has" | "hasService" | "subscribe">,
  options: DynamicOptions,
): DynamicController {
  if (!options?.config) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
      throw new TypeError("blockDynamic requires config");
    console.warn("CookieChimp dynamic blocker ignored missing config");
    return noop();
  }
  const doc = options.document ?? globalThis.document;
  if (!doc?.defaultView) return noop();
  const win = doc.defaultView;
  const config = normalizeLight(options.config);
  const reports: BlockedInfo[] = [];
  const reported = new WeakSet<Element>();
  const bypass = new WeakSet<Element>();
  let stopped = false;

  const definition = (url: string) => {
    let host: string | undefined;
    try {
      host = new URL(url, doc.baseURI).hostname;
    } catch {}
    const service = matchService(config, { url, host });
    return service
      ? config.services.find(({ id }) => id === service)
      : undefined;
  };
  const shouldBlock = (el: Element, url: string) => {
    const { ccCategory: category, ccService: service } = (el as HTMLElement)
      .dataset;
    if (
      category &&
      !(service ? consent.hasService(service) : consent.has(category))
    )
      return { category, service };
    const found = definition(url);
    return found && !consent.hasService(found.id)
      ? { category: found.category, service: found.id }
      : undefined;
  };
  const neutralise = (el: Element, value?: string): boolean => {
    if (
      stopped ||
      bypass.has(el) ||
      !(
        el instanceof win.HTMLScriptElement ||
        el instanceof win.HTMLIFrameElement
      )
    )
      return false;
    const url = value ?? el.getAttribute("src") ?? "";
    if (!url) return false;
    const match = shouldBlock(el, url);
    if (!match) return false;
    bypass.add(el);
    el.removeAttribute("src");
    const data = (el as HTMLElement).dataset;
    data.ccSrc = url;
    data.ccCategory = match.category;
    if (match.service) data.ccService = match.service;
    data.ccBlocked = "true";
    if (el instanceof win.HTMLScriptElement) {
      el.dataset.ccType = el.type || "text/javascript";
      el.type = "text/plain";
    }
    bypass.delete(el);
    if (!reported.has(el)) {
      reported.add(el);
      const info: BlockedInfo = {
        url,
        category: match.category,
        kind: el instanceof win.HTMLScriptElement ? "script" : "iframe",
        ts: Date.now(),
        ...(match.service ? { service: match.service } : {}),
      };
      reports.push(info);
      options.onBlock?.(info);
    }
    return true;
  };
  const scanRoot = (root: ParentNode) => {
    if (root instanceof win.Element) neutralise(root);
    for (const el of root.querySelectorAll("script,iframe")) neutralise(el);
  };

  const releases: Array<() => void> = [];
  const patchMethod = (
    target: object,
    key: PropertyKey,
    before: (self: unknown, args: unknown[]) => unknown[],
  ) => {
    releases.push(
      acquire(target, key, (descriptor) => {
        const previous = descriptor.value as (...args: unknown[]) => unknown;
        return {
          ...descriptor,
          value: function (this: unknown, ...args: unknown[]) {
            return Reflect.apply(previous, this, before(this, args));
          },
        };
      }),
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
    if (
      String(args[0]).toLowerCase() === "src" &&
      self instanceof win.Element &&
      neutralise(self, String(args[1]))
    )
      return ["data-cc-src", String(args[1])];
    return args;
  });
  for (const prototype of [
    win.HTMLScriptElement.prototype,
    win.HTMLIFrameElement.prototype,
  ]) {
    releases.push(
      acquire(prototype, "src", (descriptor) => ({
        ...descriptor,
        get(this: Element) {
          return descriptor.get?.call(this);
        },
        set(this: Element, value: string) {
          if (!neutralise(this, String(value)))
            descriptor.set?.call(this, value);
        },
      })),
    );
  }

  const observer = new win.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof win.Element)
        neutralise(record.target);
      for (const node of record.addedNodes)
        if (node instanceof win.Element) scanRoot(node);
    }
  });
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  const unsubscribe = consent.subscribe(() => {
    if (stopped) return;
    for (const el of doc.querySelectorAll<HTMLElement>(
      "[data-cc-blocked][data-cc-src]",
    )) {
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
        for (const release of releases.reverse()) release();
      }
    },
    scan() {
      if (!stopped) scanRoot(doc);
    },
    blocked: () => [...reports],
  };
}
