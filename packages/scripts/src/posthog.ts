import type { ScriptPreset } from "./index";
import { validateId } from "./shared";
import { globalName, type Host, methodQueue, vendor } from "./vendor";
export interface PosthogOptions {
  apiKey: string;
  region?: "us" | "eu";
  category?: string;
  globalName?: string;
  nonce?: string;
}
export function posthog({
  apiKey,
  region = "us",
  category = "analytics",
  globalName: requested = "posthog",
  nonce,
}: PosthogOptions): ScriptPreset {
  validateId("PostHog project", apiKey, /^phc_[A-Za-z0-9]{20,64}$/);
  const zone = validateId("PostHog region", region, /^(us|eu)$/)
    ? region
    : "us";
  const name = globalName("PostHog global", requested, "posthog");
  return vendor(
    "posthog",
    category,
    `https://${zone}-assets.i.posthog.com/static/array.js`,
    [`https://${zone}-assets.i.posthog.com/static/*`],
    ["posthog.com", "*.posthog.com"],
    name,
    (host) => {
      const call = methodQueue(host, name, [
        "capture",
        "identify",
        "alias",
        "register",
        "reset",
        "group",
        "opt_in_capturing",
        "opt_out_capturing",
      ]);
      const stub: Host = host[name];
      // Only the pre-load stub array takes an init entry, never the loaded library.
      if (Array.isArray(host[name]) && !stub._i) {
        stub._i = [];
        stub._i.push([
          apiKey,
          { api_host: `https://${zone}.i.posthog.com` },
          name,
        ]);
      }
      return call;
    },
    nonce,
    (host, granted) =>
      host[name][granted ? "opt_in_capturing" : "opt_out_capturing"](),
  );
}
