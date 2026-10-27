import { object } from "./presentation";

/** What a mobile SDK collects, in the shape of the app store privacy labels. */
export interface AppData {
  /** Data type keys, such as `device_id` or `crash_data`. */
  collected: string[];
  /** Purpose keys, such as `analytics` or `third_party_advertising`. */
  purposes: string[];
  /** Whether the SDK tracks people across other companies' apps and websites. */
  tracking?: boolean;
  /** How long the data is kept, as written in the dashboard. */
  retention?: string;
  /** CocoaPods or Swift packages, and Gradle coordinates. */
  packages: { ios: string[]; android: string[] };
}

/**
 * The data types from Apple's App Privacy details, which map onto Google
 * Play's Data safety types. The dashboard offers the same keys.
 */
export const DATA_TYPES: Record<string, string> = {
  name: "Name",
  email: "Email address",
  phone: "Phone number",
  address: "Physical address",
  other_contact: "Other contact info",
  health: "Health",
  fitness: "Fitness",
  payment_info: "Payment info",
  credit_info: "Credit info",
  other_financial: "Other financial info",
  precise_location: "Precise location",
  coarse_location: "Approximate location",
  sensitive_info: "Sensitive info",
  contacts: "Contacts",
  messages: "Messages",
  photos_videos: "Photos or videos",
  audio: "Audio",
  gameplay: "Gameplay content",
  customer_support: "Customer support",
  other_content: "Other user content",
  browsing_history: "Browsing history",
  search_history: "Search history",
  user_id: "User ID",
  device_id: "Device ID",
  advertising_id: "Advertising ID",
  purchase_history: "Purchase history",
  product_interaction: "App interactions",
  advertising_data: "Advertising data",
  other_usage: "Other usage data",
  crash_data: "Crash data",
  performance_data: "Performance data",
  other_diagnostics: "Other diagnostic data",
  other_data: "Other data",
};

export const PURPOSES: Record<string, string> = {
  app_functionality: "App functionality",
  analytics: "Analytics",
  personalization: "Personalization",
  developer_advertising: "Our own advertising",
  third_party_advertising: "Third-party advertising",
  fraud_prevention: "Fraud prevention and security",
  account_management: "Account management",
  developer_communications: "Communications",
  other_purposes: "Other purposes",
};

const texts = (value: unknown, max = 128) =>
  (Array.isArray(value) ? value : []).filter(
    (item): item is string =>
      typeof item === "string" && !!item.trim() && item.length <= max,
  );

/** A vendor's app data labels from the dashboard, or undefined when it has none. */
export function appData(value: unknown): AppData | undefined {
  const data = object(value);
  const packages = object(data.packages);
  const parsed: AppData = {
    collected: [...new Set(texts(data.collected))],
    purposes: [...new Set(texts(data.purposes))],
    tracking: typeof data.tracking === "boolean" ? data.tracking : undefined,
    retention:
      typeof data.retention === "string" && data.retention.trim()
        ? data.retention.trim().slice(0, 256)
        : undefined,
    packages: {
      ios: texts(packages.ios, 256),
      android: texts(packages.android, 256),
    },
  };
  const empty =
    !parsed.collected.length &&
    !parsed.purposes.length &&
    parsed.tracking === undefined &&
    !parsed.retention &&
    !parsed.packages.ios.length &&
    !parsed.packages.android.length;
  return empty ? undefined : parsed;
}

/** A readable label for a data type or purpose key the SDK may not know yet. */
export const label = (labels: Record<string, string>, key: string) =>
  (Object.hasOwn(labels, key) ? labels[key] : undefined) ??
  key.replace(/[_-]+/g, " ").replace(/^./, (first) => first.toUpperCase());
