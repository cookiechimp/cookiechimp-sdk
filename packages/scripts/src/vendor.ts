import type { ScriptPreset } from "./index";
import { preset, validateId } from "./shared";

// biome-ignore lint/suspicious/noExplicitAny: vendor globals have no shared shape.
export type Host = Record<string, any>;
export type Install = (host: Host) => (...args: unknown[]) => void;

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
): ScriptPreset {
  return {
    ...preset(id, category, src, scripts, domains, {}, nonce),
    queue: {
      dataLayerName: name,
      install: (target = globalThis as never) => install(target as Host),
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
