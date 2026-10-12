import type { NormalizedConfig, normalizeConfig } from "./config";
import type { ConsentRuntime } from "./index";
import type { BlockedInfo } from "./internal/blocked";
import { prepareServiceFinder } from "./internal/blocker";
import { fail } from "./internal/dev";
import { normalizeLight } from "./internal/normalize-light";
import { acquire, type PatchFactory } from "./internal/patch";
import { resolveHttp } from "./internal/url";

export type { BlockedInfo } from "./internal/blocked";

export interface NetworkOptions {
  config: Parameters<typeof normalizeConfig>[0] | NormalizedConfig;
  window?: Window;
  onBlock?: (info: BlockedInfo) => void;
}

export interface NetworkController {
  stop(): void;
  blocked(): BlockedInfo[];
}

/** Error returned by a fetch that CookieChimp prevented from starting. */
export class ConsentBlockedError extends TypeError {}

const noop: NetworkController = { stop() {}, blocked: () => [] };
function descriptorOwner(target: object, key: PropertyKey): object | undefined {
  while (target && !Object.hasOwn(target, key))
    target = Object.getPrototypeOf(target);
  return target;
}

/** Block matching fetch, XHR, and beacon requests. Blocked requests are dropped. */
export function blockNetwork(
  consent: Pick<ConsentRuntime, "hasService">,
  options: NetworkOptions,
): NetworkController {
  if (!options?.config) {
    fail("Invalid blockNetwork options");
    return noop;
  }
  if (options.onBlock !== undefined && typeof options.onBlock !== "function") {
    fail("Invalid blockNetwork options");
    return noop;
  }
  const win = (options.window ?? globalThis.window) as
    | (Window & typeof globalThis)
    | undefined;
  if (!win) return noop;
  const config = normalizeLight(options.config);
  const findService = prepareServiceFinder(config);
  const reports: BlockedInfo[] = [];
  const releases: Array<() => void> = [];
  let matchWarned = false;
  const patch = (target: object, key: PropertyKey, factory: PatchFactory) => {
    const owner = descriptorOwner(target, key);
    if (owner) releases.push(acquire(owner, key, factory));
  };

  const match = (source: unknown) => {
    let value: string;
    try {
      value = source instanceof win.Request ? source.url : String(source);
    } catch {
      return;
    }
    let found: ReturnType<typeof findService>;
    try {
      found = findService(value, win.document.baseURI);
    } catch {
      const url = resolveHttp(value, win.document.baseURI);
      if (!url) return;
      if (!matchWarned) {
        matchWarned = true;
        console.warn("CookieChimp matcher failed");
      }
      return { url: url.href };
    }
    if (!found) return;
    const [url, { id, category }] = found;
    if (consent.hasService(id)) return;
    return {
      url: url.href,
      service: id,
      category,
    };
  };
  const report = (
    found: { url: string; service?: string; category?: string },
    kind: "fetch" | "xhr" | "beacon",
  ) => {
    const info: BlockedInfo = { ...found, kind, ts: Date.now() };
    reports.push(info);
    options.onBlock?.(info);
  };

  patch(win, "fetch", (descriptor) => {
    const native = (descriptor.value ??
      descriptor.get?.call(win)) as typeof fetch;
    return {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      writable: true,
      value: function (
        this: unknown,
        input: RequestInfo | URL,
        init?: RequestInit,
      ) {
        const found = match(input);
        if (found) {
          report(found, "fetch");
          return Promise.reject(new ConsentBlockedError());
        }
        return Reflect.apply(native, this, [input, init]);
      },
    };
  });

  const xhrUrls = new WeakMap<XMLHttpRequest, unknown>();
  const xhr = win.XMLHttpRequest?.prototype;
  if (xhr) {
    patch(xhr, "open", (descriptor) => ({
      ...descriptor,
      value: function (this: XMLHttpRequest, ...args: unknown[]) {
        xhrUrls.set(this, args[1]);
        return Reflect.apply(descriptor.value, this, args);
      },
    }));
    patch(xhr, "send", (descriptor) => ({
      ...descriptor,
      value: function (this: XMLHttpRequest, ...args: unknown[]) {
        const found = match(xhrUrls.get(this));
        if (!found) return Reflect.apply(descriptor.value, this, args);
        report(found, "xhr");
        // Mirror a real network error: DONE state, status 0, async events.
        Object.defineProperty(this, "readyState", {
          configurable: true,
          get: () => 4,
        });
        setTimeout(() => {
          const Progress = win.ProgressEvent ?? win.Event;
          for (const type of ["readystatechange", "error", "loadend"])
            this.dispatchEvent(new Progress(type) as Event);
        });
      },
    }));
  }

  patch(win.navigator, "sendBeacon", (descriptor) => ({
    ...descriptor,
    value: function (
      this: Navigator,
      url: string | URL,
      data?: BodyInit | null,
    ) {
      const found = match(url);
      if (found) {
        report(found, "beacon");
        return false;
      }
      return Reflect.apply(descriptor.value, this, [url, data]);
    },
  }));

  return {
    stop() {
      for (const release of releases.reverse()) release();
    },
    blocked: () => [...reports],
  };
}
