import type { ScriptPreset } from "./index";
import { preset, validateId } from "./shared";
export interface Ga4Options {
  measurementId: string;
  category?: string;
  nonce?: string;
}
export function ga4({
  measurementId,
  category = "analytics",
  nonce,
}: Ga4Options): ScriptPreset {
  validateId("GA4 measurement", measurementId, /^G-[A-Z0-9]+$/);
  return preset(
    "ga4",
    category,
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
    ["https://www.googletagmanager.com/gtag/js?id=*"],
    ["google-analytics.com", "*.google-analytics.com"],
    { [category]: ["analytics_storage"] },
    nonce,
  );
}
