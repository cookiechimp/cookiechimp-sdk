import type { ConfigInput, NormalizedConfig, ServiceConfig } from "../config";
import { fail } from "./dev";
import { validPattern } from "./pattern";

type LightConfig = Omit<ConfigInput, "services"> & {
  services: readonly ServiceConfig[];
};

/** Canonicalise the small portion of configuration used by request blockers. */
export function normalizeLight(
  config: ConfigInput | NormalizedConfig,
): LightConfig {
  const input = config.services ?? [];
  const patterns = (value: unknown) =>
    value === undefined || (Array.isArray(value) && value.every(validPattern));
  const services = input.filter((service) => {
    try {
      return (
        !!service &&
        typeof service.id === "string" &&
        typeof service.category === "string" &&
        patterns(service.scripts) &&
        patterns(service.domains) &&
        patterns(service.cookies)
      );
    } catch {
      return false;
    }
  });
  if (services.length === input.length) return config as LightConfig;
  fail("Invalid consent config for CookieChimp blocker");
  return { ...config, services };
}
