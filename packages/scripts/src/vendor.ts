import type { ConsentSource, ScriptPreset } from "./index";
import { preset, validateId } from "./shared";

// biome-ignore lint/suspicious/noExplicitAny: vendor globals have no shared shape.
export type Host = Record<string, any>;
export type Install = (host: Host) => (...args: unknown[]) => void;
export type Apply = (host: Host, granted: boolean) => void;

/** Global names must be plain identifiers, never prototype keys. */
export const globalName = (kind: string, name: string, fallback: string) =>
  validateId(kind, name, /^(?!__proto__$)[A-Za-z_$][\w$]*$/) ? name : fallback;

/** A gated non-Google preset. It maps no Google Consent Mode signal. */
export function vendor(
  id: string,
  category: string,
  src: string,
  scripts: string[],
  domains: string[],
  name: string,
  install: Install,
  nonce?: string,
  apply?: Apply,
): ScriptPreset {
  return {
    ...preset(id, category, src, scripts, domains, {}, nonce),
    queue: {
      dataLayerName: name,
      install: (target = globalThis as never) => install(target as Host),
    },
    revoke: apply ? "api" : "reload",
    // Installing the stub first means a call made before the vendor script
    // loads is queued and replayed by the vendor, never dropped.
    sync(consent: ConsentSource, target: object = globalThis) {
      const host = target as Host;
      install(host);
      let last: boolean | undefined;
      const run = (state: ReturnType<ConsentSource["get"]>) => {
        const granted = state.categories[category] === true;
        if (granted === last) return;
        last = granted;
        apply?.(host, granted);
      };
      run(consent.get());
      return consent.subscribe(run);
    },
  };
}

/** Array stub that records `[method, ...args]` until the vendor library loads. */
export function methodQueue(host: Host, name: string, methods: string[]) {
  host[name] ??= [];
  const stub: Host = host[name];
  for (const method of methods)
    stub[method] ??= (...args: unknown[]) => stub.push([method, ...args]);
  return (method: unknown, ...args: unknown[]) => {
    stub.push([method, ...args]);
  };
}

/** Function stub that records its arguments on `fn.q`. */
export function callQueue(host: Host, name: string) {
  host[name] ??= (...args: unknown[]) => {
    fn.q.push(args);
  };
  const fn: Host = host[name];
  fn.q ??= [];
  return fn as (...args: unknown[]) => void;
}
