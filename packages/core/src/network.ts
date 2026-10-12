import type { NormalizedConfig, normalizeConfig } from "./config";
import type { ConsentRuntime } from "./index";
import type { BlockedInfo } from "./internal/blocked";
import { normalizeLight } from "./internal/normalize-light";
import { acquire } from "./internal/patch";
import { isHttpUrl } from "./internal/url";
import { matchService } from "./match";

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

const noop = (): NetworkController => ({ stop() {}, blocked: () => [] });
function invalid(): void {
  const message = "Invalid blockNetwork options";
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(message);
  console.warn(message);
}

function descriptorOwner(target: object, key: PropertyKey): object | undefined {
  let current: object | null = target;
  while (current && !Object.hasOwn(current, key))
    current = Object.getPrototypeOf(current);
  return current ?? undefined;
}

/** Block matching fetch, XHR, and beacon requests. Blocked requests are dropped. */
export function blockNetwork(
  consent: Pick<ConsentRuntime, "hasService">,
  options: NetworkOptions,
): NetworkController {
  if (!options?.config) {
    invalid();
    return noop();
  }
  if (options.onBlock !== undefined && typeof options.onBlock !== "function") {
    invalid();
    return noop();
  }
  const win = (options.window ?? globalThis.window) as
    | (Window & typeof globalThis)
    | undefined;
  if (!win) return noop();
  const config = normalizeLight(options.config);
  const reports: BlockedInfo[] = [];
  const releases: Array<() => void> = [];

  const match = (source: unknown) => {
    const raw =
      source instanceof win.Request ? source.url : String(source);
    if (!isHttpUrl(raw, win.document.baseURI)) return undefined;
    const url = new URL(raw, win.document.baseURI);
    const service = matchService(config, { url: url.href, host: url.hostname });
    if (!service || consent.hasService(service)) return undefined;
    const definition = config.services.find(({ id }) => id === service);
    return definition
      ? { url: url.href, service, category: definition.category }
      : undefined;
  };
  const report = (
    found: { url: string; service: string; category: string },
    kind: "fetch" | "xhr" | "beacon",
  ) => {
    const info: BlockedInfo = { ...found, kind, ts: Date.now() };
    reports.push(info);
    options.onBlock?.(info);
  };

  const fetchOwner = descriptorOwner(win, "fetch");
  if (fetchOwner)
    releases.push(
      acquire(fetchOwner, "fetch", (descriptor) => {
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
      }),
    );

  const xhrUrls = new WeakMap<XMLHttpRequest, unknown>();
  const xhr = win.XMLHttpRequest?.prototype;
  if (xhr) {
    const openOwner = descriptorOwner(xhr, "open");
    const sendOwner = descriptorOwner(xhr, "send");
    if (openOwner)
      releases.push(
        acquire(openOwner, "open", (descriptor) => {
          const native = descriptor.value as (...args: unknown[]) => unknown;
          return {
            ...descriptor,
            value: function (this: XMLHttpRequest, ...args: unknown[]) {
              xhrUrls.set(this, args[1]);
              return Reflect.apply(native, this, args);
            },
          };
        }),
      );
    if (sendOwner)
      releases.push(
        acquire(sendOwner, "send", (descriptor) => {
          const native = descriptor.value as (...args: unknown[]) => unknown;
          return {
            ...descriptor,
            value: function (this: XMLHttpRequest, ...args: unknown[]) {
              const found = match(xhrUrls.get(this));
              if (!found) return Reflect.apply(native, this, args);
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
          };
        }),
      );
  }

  const beaconOwner = descriptorOwner(win.navigator, "sendBeacon");
  if (beaconOwner)
    releases.push(
      acquire(beaconOwner, "sendBeacon", (descriptor) => {
        const native = descriptor.value as Navigator["sendBeacon"];
        return {
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
            return Reflect.apply(native, this, [url, data]);
          },
        };
      }),
    );

  return {
    stop() {
      for (const release of releases.reverse()) release();
    },
    blocked: () => [...reports],
  };
}
