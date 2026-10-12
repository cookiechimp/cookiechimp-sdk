import type { ConfigInput, NormalizedConfig, ServiceConfig } from "../config";
import type { ServiceMatch } from "../match";
import { resolveHttp } from "./url";

const cache = new WeakMap<object, ReturnType<typeof compile>>();
const wildcard = (value: string, host = false) =>
  new RegExp(
    `^${value.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`,
    host ? "i" : "",
  );
const pattern = (value: string | RegExp, host = false) =>
  value instanceof RegExp
    ? new RegExp(value.source, value.flags.replace(/[gy]/g, ""))
    : wildcard(value, host);
const compile = (config: ConfigInput | NormalizedConfig) =>
  (config.services ?? []).map(
    ({ id, scripts = [], cookies = [], domains = [] }) =>
      [
        id,
        scripts.map((value) => pattern(value)),
        cookies.map((value) => pattern(value)),
        domains.map((value) => pattern(value, true)),
      ] as const,
  );

/** Prepare a matcher so request interception never recompiles its patterns. */
export function prepareMatcher(config: ConfigInput | NormalizedConfig) {
  let compiled = cache.get(config);
  if (!compiled) {
    compiled = compile(config);
    cache.set(config, compiled);
  }
  return ({ url, cookieName, host }: ServiceMatch): string | null => {
    for (const [id, scripts, cookies, domains] of compiled)
      if (
        (url && scripts.some((value) => value.test(url))) ||
        (cookieName && cookies.some((value) => value.test(cookieName))) ||
        (host && domains.some((value) => value.test(host)))
      )
        return id;
    return null;
  };
}

export function prepareServiceFinder(config: ConfigInput | NormalizedConfig) {
  const match = prepareMatcher(config);
  const services = new Map(
    (config.services ?? []).map((service) => [service.id, service]),
  );
  return (source: string, base: string): [URL, ServiceConfig] | undefined => {
    const url = resolveHttp(source, base);
    if (!url) return;
    const id = match({ url: url.href, host: url.hostname });
    const service = id && services.get(id);
    if (service) return [url, service];
  };
}
