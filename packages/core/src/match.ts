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
    let invalid = false;
    result = (config.services ?? [])
      .filter((service) => {
        const valid =
          typeof service.id === "string" &&
          [service.scripts, service.cookies, service.domains].every(
            (value) => value === undefined || Array.isArray(value),
          );
        invalid ||= !valid;
        return valid;
      })
      .map(({ id, scripts = [], cookies = [], domains = [] }) => [
        id,
        scripts.map((pattern) =>
          pattern instanceof RegExp
            ? new RegExp(pattern.source, pattern.flags)
            : wildcard(pattern),
        ),
        cookies.map((pattern) => wildcard(pattern)),
        domains.map((pattern) => wildcard(pattern, true)),
      ]);
    if (invalid) {
      const message = "Invalid consent config for CookieChimp blocker";
      if (
        typeof process !== "undefined" &&
        process.env.NODE_ENV !== "production"
      )
        throw new TypeError(message);
      console.warn(message);
    }
    cache.set(config, result);
  }
  return result;
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
  for (const [id, scripts, cookies, domains] of compile(config)) {
    if (
      (target.url &&
        scripts.some((pattern) => pattern.test(target.url as string))) ||
      (target.cookieName &&
        cookies.some((pattern) => pattern.test(target.cookieName as string))) ||
      (target.host &&
        domains.some((pattern) => pattern.test(target.host as string)))
    )
      return id;
  }
  return null;
}
