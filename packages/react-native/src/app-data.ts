import en from "./locales/en";
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
 * English names of the data types from Apple's App Privacy details, which map
 * onto Google Play's Data safety types. The dashboard offers the same keys.
 * `messages(language).dataType(key)` returns them in other languages.
 */
export const DATA_TYPES: Readonly<Record<string, string>> = en.data;

/** English names of the purposes. See `messages(language).purpose(key)`. */
export const PURPOSES: Readonly<Record<string, string>> = en.purposes;

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
