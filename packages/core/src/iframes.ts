import {
  isDevelopment,
  type NormalizedConfig,
  normalizeConfig,
} from "./config";
import type { ConsentRuntime } from "./index";
import { matchService } from "./match";

export interface GateOptions {
  /** Service definitions used to identify runtime-inserted resources. */
  config?: Parameters<typeof normalizeConfig>[0] | NormalizedConfig;
  /** Intercept runtime-inserted scripts and frames matching configured services. */
  blockDynamic?: boolean;
  /** Called when an allowed category or service is subsequently revoked. */
  onRevoke?: (category: string, service?: string) => void;
  /** Reload the page when previously granted consent is revoked. Defaults to false. */
  reloadOnRevoke?: boolean;
  /** Called when an iframe is blocked. Core does not apply placeholder styling. */
  placeholder?: (iframe: HTMLIFrameElement, category: string) => void;
  /** Document override, primarily useful for isolated documents and tests. */
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

const noOpController = (): GateController => ({
  stop() {},
  scan() {},
  blocked: () => [],
});

function reportInvalid(message: string): void {
  if (isDevelopment())
    throw new TypeError(`Invalid gateScripts options: ${message}`);
  console.warn(`CookieChimp ignored invalid gateScripts options: ${message}`);
}

/**
 * Activate declaratively gated scripts and iframes as consent changes.
 * Script gating intentionally lives in the `@cookiechimp/core/iframes` subpath.
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
    reportInvalid("consent must provide has, hasService, and subscribe");
    return noOpController();
  }
  if (
    options.blockDynamic !== undefined &&
    typeof options.blockDynamic !== "boolean"
  ) {
    reportInvalid("blockDynamic must be a boolean");
    return noOpController();
  }
  if (
    options.placeholder !== undefined &&
    typeof options.placeholder !== "function"
  ) {
    reportInvalid("placeholder must be a function");
    return noOpController();
  }
  if (
    options.onRevoke !== undefined &&
    typeof options.onRevoke !== "function"
  ) {
    reportInvalid("onRevoke must be a function");
    return noOpController();
  }
  const doc =
    options.document ??
    (typeof document === "undefined" ? undefined : document);
  if (!doc) return noOpController();
  const config = options.config
    ? Object.isFrozen(options.config)
      ? (options.config as NormalizedConfig)
      : normalizeConfig(options.config)
    : undefined;
  if (options.blockDynamic && !config) {
    reportInvalid("config is required when blockDynamic is true");
    return noOpController();
  }

  let stopped = false;
  const done = new WeakSet<Element>();
  const pending = new Map<Element, BlockedElement>();
  const granted = new Map<string, boolean>();
  let ordered = Promise.resolve();
  const allowed = (category: string, service?: string) =>
    service ? consent.hasService(service) : consent.has(category);

  const activateScript = (script: HTMLScriptElement) => {
    if (done.has(script)) return;
    const category = script.dataset.ccCategory;
    if (!category) return;
    const service = script.dataset.ccService;
    if (!allowed(category, service)) {
      pending.set(script, {
        el: script,
        category,
        ...(service ? { service } : {}),
      });
      return;
    }
    done.add(script);
    pending.delete(script);
    const activate = () =>
      new Promise<void>((resolve) => {
        if (!script.isConnected || stopped) return resolve();
        const fresh = doc.createElement("script");
        for (const { name, value } of [...script.attributes]) {
          if (
            name !== "type" &&
            name !== "data-cc-blocked" &&
            name !== "data-cc-type"
          )
            fresh.setAttribute(name, value);
        }
        fresh.type =
          script.dataset.ccType ||
          (script.type === "module" ? "module" : "text/javascript");
        fresh.textContent = script.textContent;
        fresh.dataset.ccActivated = "true";
        const isAsync = script.hasAttribute("async");
        if (!isAsync) fresh.async = false;
        if (fresh.src && !isAsync) {
          fresh.addEventListener("load", () => resolve(), { once: true });
          fresh.addEventListener("error", () => resolve(), { once: true });
        } else resolve();
        script.replaceWith(fresh);
      });
    if (script.src && script.hasAttribute("async")) void activate();
    else ordered = ordered.then(activate);
  };

  const activateFrame = (frame: HTMLIFrameElement) => {
    if (done.has(frame)) return;
    const category = frame.dataset.ccCategory;
    const source = frame.dataset.ccSrc;
    if (!category || !source) return;
    const service = frame.dataset.ccService;
    if (!allowed(category, service)) {
      pending.set(frame, {
        el: frame,
        category,
        ...(service ? { service } : {}),
      });
      options.placeholder?.(frame, category);
      return;
    }
    done.add(frame);
    pending.delete(frame);
    frame.src = source;
    delete frame.dataset.ccSrc;
    delete frame.dataset.ccBlocked;
  };

  const neutralise = (element: Element) => {
    if (!options.blockDynamic || !config || done.has(element)) return;
    if (
      element instanceof HTMLScriptElement &&
      element.src &&
      element.type !== "text/plain" &&
      !element.dataset.ccActivated
    ) {
      const service = matchService(config, { url: element.src });
      const definition = config.services.find(({ id }) => id === service);
      if (service && definition && !consent.hasService(service)) {
        element.dataset.ccType = element.type || "text/javascript";
        element.type = "text/plain";
        element.dataset.ccBlocked = "true";
        element.dataset.ccCategory = definition.category;
        element.dataset.ccService = service;
      }
    } else if (
      element instanceof HTMLIFrameElement &&
      element.src &&
      element.src !== "about:blank"
    ) {
      const service = matchService(config, {
        url: element.src,
        host: new URL(element.src).hostname,
      });
      const definition = config.services.find(({ id }) => id === service);
      if (service && definition && !consent.hasService(service)) {
        element.dataset.ccSrc = element.src;
        element.dataset.ccCategory = definition.category;
        element.dataset.ccService = service;
        element.dataset.ccBlocked = "true";
        element.src = "about:blank";
        options.placeholder?.(element, definition.category);
      }
    }
  };

  const process = (root: ParentNode) => {
    const elements: Element[] = root instanceof Element ? [root] : [];
    elements.push(...root.querySelectorAll("script,iframe"));
    for (const element of elements) {
      neutralise(element);
      if (
        element instanceof HTMLScriptElement &&
        element.type === "text/plain" &&
        element.dataset.ccCategory
      )
        activateScript(element);
      if (
        element instanceof HTMLIFrameElement &&
        element.dataset.ccSrc &&
        element.dataset.ccCategory
      )
        activateFrame(element);
    }
  };
  const restores: Array<() => void> = [];
  if (options.blockDynamic && doc.defaultView) {
    const patchInsertion = <T extends object, K extends keyof T>(
      prototype: T,
      name: K,
    ) => {
      const original = prototype[name];
      if (typeof original !== "function") return;
      const wrapped = function (this: unknown, ...args: unknown[]) {
        for (const value of args)
          if (value instanceof Element) neutralise(value);
        return Reflect.apply(original, this, args);
      };
      prototype[name] = wrapped as T[K];
      restores.push(() => {
        prototype[name] = original;
      });
    };
    patchInsertion(doc.defaultView.Node.prototype, "appendChild");
    patchInsertion(doc.defaultView.Node.prototype, "insertBefore");
    patchInsertion(doc.defaultView.Element.prototype, "append");
    patchInsertion(doc.defaultView.Element.prototype, "prepend");
  }
  const scan = () => {
    if (!stopped) process(doc);
  };
  scan();
  const observer =
    typeof MutationObserver === "undefined"
      ? undefined
      : new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (node instanceof Element) process(node);
        });
  observer?.observe(doc.documentElement, { childList: true, subtree: true });
  const unsubscribe = consent.subscribe(() => {
    if (stopped) return;
    for (const [key, wasGranted] of granted) {
      const [category, service] = key.split("\0");
      if (wasGranted && !allowed(category ?? "", service || undefined)) {
        options.onRevoke?.(category ?? "", service || undefined);
        if (options.reloadOnRevoke) doc.defaultView?.location.reload();
      }
    }
    for (const item of pending.values())
      granted.set(
        `${item.category}\0${item.service ?? ""}`,
        allowed(item.category, item.service),
      );
    scan();
  });
  for (const item of pending.values())
    granted.set(
      `${item.category}\0${item.service ?? ""}`,
      allowed(item.category, item.service),
    );
  return {
    stop() {
      if (!stopped) {
        stopped = true;
        observer?.disconnect();
        unsubscribe();
        for (const restore of restores) restore();
      }
    },
    scan,
    blocked: () => [...pending.values()],
  };
}
