import type { ConfigInput, NormalizedConfig, ServiceConfig } from "../config";

type LightConfig = Omit<ConfigInput, "services"> & {
  services: readonly ServiceConfig[];
};

/** Canonicalise the small portion of configuration used by request blockers. */
export function normalizeLight(
  config: ConfigInput | NormalizedConfig,
): LightConfig {
  const input = config.services ?? [];
  const services = input.filter(
    (service) =>
      service &&
      typeof service.id === "string" &&
      [service.scripts, service.cookies, service.domains].every(
        (items) => items === undefined || Array.isArray(items),
      ),
  );
  if (services.length === input.length) return config as LightConfig;
  const message = "Invalid consent config for CookieChimp blocker";
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(message);
  console.warn(message);
  return { ...config, services };
}
