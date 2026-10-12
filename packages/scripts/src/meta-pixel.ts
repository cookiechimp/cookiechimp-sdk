import type { ScriptPreset } from "./index";
import { validateId } from "./shared";
import { type Host, vendor } from "./vendor";
export interface MetaPixelOptions {
  pixelId: string;
  category?: string;
  nonce?: string;
}
export function metaPixel({
  pixelId,
  category = "marketing",
  nonce,
}: MetaPixelOptions): ScriptPreset {
  validateId("Meta Pixel", pixelId, /^\d{15,16}$/);
  return vendor(
    "meta-pixel",
    category,
    "https://connect.facebook.net/en_US/fbevents.js",
    ["https://connect.facebook.net/*"],
    ["facebook.com", "*.facebook.com", "facebook.net", "*.facebook.net"],
    "fbq",
    (host: Host) => {
      if (!host.fbq) {
        const fbq: Host = (...args: unknown[]) => {
          fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
        };
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = [];
        host.fbq = fbq;
        host._fbq ??= fbq;
        host.fbq("init", pixelId);
      }
      return host.fbq;
    },
    nonce,
  );
}
