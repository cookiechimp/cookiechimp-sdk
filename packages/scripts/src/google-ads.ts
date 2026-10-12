import type { ScriptPreset } from "./index";
import { encodeId, preset, validateId } from "./shared";
export interface GoogleAdsOptions {
  conversionId: string;
  category?: string;
  nonce?: string;
}
export function googleAds({
  conversionId,
  category = "marketing",
  nonce,
}: GoogleAdsOptions): ScriptPreset {
  validateId("Google Ads conversion", conversionId, /^AW-[A-Z0-9]+$/);
  return preset(
    "google-ads",
    category,
    `https://www.googletagmanager.com/gtag/js?id=${encodeId(conversionId)}`,
    [
      "https://www.googletagmanager.com/gtag/js?id=AW-*",
      "https://www.googleadservices.com/*",
      "https://googleads.g.doubleclick.net/*",
    ],
    [
      "googleadservices.com",
      "*.googleadservices.com",
      "doubleclick.net",
      "*.doubleclick.net",
    ],
    { [category]: ["ad_storage", "ad_user_data", "ad_personalization"] },
    nonce,
  );
}
