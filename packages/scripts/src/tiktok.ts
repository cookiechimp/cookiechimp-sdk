import type { ScriptPreset } from "./index";
import { encodeId, validateId } from "./shared";
import { methodQueue, vendor } from "./vendor";
export interface TiktokOptions {
  pixelId: string;
  category?: string;
  nonce?: string;
}
export function tiktok({
  pixelId,
  category = "marketing",
  nonce,
}: TiktokOptions): ScriptPreset {
  validateId("TikTok pixel", pixelId, /^[A-Z0-9]{20}$/);
  return vendor(
    "tiktok",
    category,
    `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeId(pixelId)}&lib=ttq`,
    ["https://analytics.tiktok.com/i18n/pixel/*"],
    ["tiktok.com", "*.tiktok.com"],
    "ttq",
    (host) => {
      const call = methodQueue(host, "ttq", [
        "page",
        "track",
        "identify",
        "grantConsent",
        "revokeConsent",
        "holdConsent",
      ]);
      host.ttq._i ??= {};
      host.ttq._i[pixelId] ??= [];
      return call;
    },
    nonce,
  );
}
