import type { ScriptPreset } from "./index";
import { encodeId, preset, validateId } from "./shared";
export interface GtmOptions {
  containerId: string;
  category: string;
  dataLayerName?: string;
  nonce?: string;
  consentMode?: "basic" | "advanced";
}
export function gtm({
  containerId,
  category,
  dataLayerName: layerName = "dataLayer",
  nonce,
  consentMode = "basic",
}: GtmOptions): ScriptPreset {
  validateId("GTM container", containerId, /^GTM-[A-Z0-9]+$/);
  // A plain identifier only: no URL parts, markup or prototype keys.
  const dataLayerName = validateId(
    "GTM data layer",
    layerName,
    /^(?!__proto__$)[A-Za-z_$][\w$]*$/,
  )
    ? layerName
    : "dataLayer";
  const query =
    dataLayerName === "dataLayer"
      ? ""
      : `&l=${encodeURIComponent(dataLayerName)}`;
  return preset(
    "gtm",
    category,
    `https://www.googletagmanager.com/gtm.js?id=${encodeId(containerId)}${query}`,
    ["https://www.googletagmanager.com/gtm.js?id=GTM-*"],
    ["googletagmanager.com", "*.googletagmanager.com"],
    // GTM is a container: it adds no Consent Mode signals of its own, so each
    // signal keeps following the category that owns it (analytics, marketing).
    {},
    nonce,
    consentMode === "advanced",
    dataLayerName,
  );
}
