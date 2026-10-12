import type { ConfigInput, NormalizedConfig, ServiceConfig } from "../config";
import { resolveHttp } from "./url";

const pattern = (value: string, host = false) =>
  new RegExp(
    `^${value.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`,
    host ? "i" : "",
  );

export function prepareServiceFinder(config: ConfigInput | NormalizedConfig) {
  const services = config.services ?? [];
  const matches = services.map(
    (service) =>
      [
        service,
        (service.scripts ?? []).map((value) =>
          value instanceof RegExp ? value : pattern(value),
        ),
        (service.domains ?? []).map((value) =>
          value instanceof RegExp ? value : pattern(value, true),
        ),
      ] as const,
  );
  return (source: string, base: string): [URL, ServiceConfig] | undefined => {
    const url = resolveHttp(source, base);
    if (!url) return;
    for (const [service, scripts, domains] of matches)
      if (
        scripts.some((value) => value.test(url.href)) ||
        domains.some((value) => value.test(url.hostname))
      )
        return [url, service];
  };
}
