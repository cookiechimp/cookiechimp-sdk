import type { ConfigInput, NormalizedConfig, ServiceConfig } from "../config";
import { matchService } from "../match";
import { resolveHttp } from "./url";

export function findService(
  config: ConfigInput | NormalizedConfig,
  source: string,
  base: string,
): [URL, ServiceConfig] | undefined {
  const url = resolveHttp(source, base);
  if (!url) return;
  const id = matchService(config, { url: url.href, host: url.hostname });
  const service = config.services?.find((item) => item.id === id);
  return service && [url, service];
}
