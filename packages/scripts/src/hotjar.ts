import type { ScriptPreset } from "./index";
import { encodeId, validateId } from "./shared";
import { callQueue, vendor } from "./vendor";
export interface HotjarOptions {
  siteId: string;
  category?: string;
  nonce?: string;
}
export function hotjar({
  siteId,
  category = "analytics",
  nonce,
}: HotjarOptions): ScriptPreset {
  validateId("Hotjar site", siteId, /^[1-9]\d{4,9}$/);
  return vendor(
    "hotjar",
    category,
    `https://static.hotjar.com/c/hotjar-${encodeId(siteId)}.js?sv=6`,
    ["https://static.hotjar.com/c/*"],
    ["hotjar.com", "*.hotjar.com", "hotjar.io", "*.hotjar.io"],
    "hj",
    (host) => {
      host._hjSettings ??= { hjid: Number(siteId), hjsv: 6 };
      return callQueue(host, "hj");
    },
    nonce,
  );
}
