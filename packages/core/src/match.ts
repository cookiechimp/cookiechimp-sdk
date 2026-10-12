import type { ConfigInput, NormalizedConfig } from "./config";

const cache = new WeakMap<
  object,
  readonly [string, readonly RegExp[], readonly RegExp[], readonly RegExp[]][]
>();

function wildcard(pattern: string, host = false): RegExp {
  return new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`,
    host ? "i" : "",
  );
}

function compile(config: ConfigInput | NormalizedConfig) {
  let result = cache.get(config);
  if (!result) {
    result = (config.services ?? []).map(
      ({ id, scripts = [], cookies = [], domains = [] }) => [
        id,
        scripts.map((pattern) =>
          pattern instanceof RegExp ? pattern : wildcard(pattern),
        ),
        cookies.map((pattern) =>
          pattern instanceof RegExp ? pattern : wildcard(pattern),
        ),
        domains.map((pattern) =>
          pattern instanceof RegExp ? pattern : wildcard(pattern, true),
        ),
      ],
    );
    cache.set(config, result);
  }
  return result;
}

/** Prepare a matcher so request interception never recompiles its patterns. */
export function prepareMatcher(config: ConfigInput | NormalizedConfig) {
  const compiled = compile(config);
  return (target: ServiceMatch): string | null => {
    const { url, cookieName, host } = target;
    for (const [id, scripts, cookies, domains] of compiled) {
      if (
        (url && scripts.some((pattern) => pattern.test(url))) ||
        (cookieName && cookies.some((pattern) => pattern.test(cookieName))) ||
        (host && domains.some((pattern) => pattern.test(host)))
      )
        return id;
    }
    return null;
  };
}

export interface ServiceMatch {
  url?: string;
  cookieName?: string;
  host?: string;
}

/** Find the first configured service matching any supplied signal. */
export function matchService(
  config: ConfigInput | NormalizedConfig,
  target: ServiceMatch,
): string | null {
  return prepareMatcher(config)(target);
}
