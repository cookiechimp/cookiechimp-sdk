import type { ConfigInput, NormalizedConfig, ServiceConfig } from "../config";
import { fail } from "./dev";

type LightConfig = Omit<ConfigInput, "services"> & {
  services: readonly ServiceConfig[];
};

/** Canonicalise the small portion of configuration used by request blockers. */
export function normalizeLight(
  config: ConfigInput | NormalizedConfig,
): LightConfig {
  const input = config.services ?? [];
  const services = input.filter(
    (service) => service && typeof service.id === "string",
  );
  if (services.length === input.length) return config as LightConfig;
  fail("Invalid consent config for CookieChimp blocker");
  return { ...config, services };
}
