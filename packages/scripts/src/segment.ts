import type { ScriptPreset } from "./index";
import { encodeId, validateId } from "./shared";
import { globalName, methodQueue, vendor } from "./vendor";
export interface SegmentOptions {
  writeKey: string;
  category?: string;
  globalName?: string;
  nonce?: string;
}
export function segment({
  writeKey,
  category = "analytics",
  globalName: requested = "analytics",
  nonce,
}: SegmentOptions): ScriptPreset {
  validateId("Segment write key", writeKey, /^[A-Za-z0-9]{32}$/);
  const name = globalName("Segment global", requested, "analytics");
  return vendor(
    "segment",
    category,
    `https://cdn.segment.com/analytics.js/v1/${encodeId(writeKey)}/analytics.min.js`,
    ["https://cdn.segment.com/analytics.js/*"],
    ["segment.com", "*.segment.com", "segment.io", "*.segment.io"],
    name,
    (host) => {
      const call = methodQueue(host, name, [
        "track",
        "identify",
        "page",
        "group",
        "alias",
        "ready",
        "reset",
      ]);
      host[name]._writeKey ??= writeKey;
      return call;
    },
    nonce,
  );
}
