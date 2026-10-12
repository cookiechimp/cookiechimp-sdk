import type { ScriptPreset } from "./index";
import { validateId } from "./shared";
import { callQueue, vendor } from "./vendor";
export interface LinkedinOptions {
  partnerId: string;
  category?: string;
  nonce?: string;
}
export function linkedin({
  partnerId,
  category = "marketing",
  nonce,
}: LinkedinOptions): ScriptPreset {
  validateId("LinkedIn partner", partnerId, /^[1-9]\d{3,9}$/);
  return vendor(
    "linkedin",
    category,
    "https://snap.licdn.com/li.lms-analytics/insight.min.js",
    ["https://snap.licdn.com/*"],
    ["licdn.com", "*.licdn.com", "px.ads.linkedin.com"],
    "lintrk",
    (host) => {
      host._linkedin_data_partner_ids ??= [];
      const ids: string[] = host._linkedin_data_partner_ids;
      if (!ids.includes(partnerId)) ids.push(partnerId);
      return callQueue(host, "lintrk");
    },
    nonce,
  );
}
