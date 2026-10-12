import type { ConsentState } from "./index";
import { inlineJson } from "./internal/inline-json";

export type ConsentModeSignal =
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization"
  | "analytics_storage"
  | "functionality_storage"
  | "personalization_storage"
  | "security_storage";
export type ConsentModeValue = "granted" | "denied";
export type ConsentModeMapping = Record<
  string,
  readonly ConsentModeSignal[] | null
>;
export interface ConsentModeOptions {
  wait_for_update?: number;
  region?: readonly string[];
  ads_data_redaction?: boolean;
  url_passthrough?: boolean;
  /** Set false when another integration already establishes the default. */
  default?: boolean;
  /** Replace the built-in category mapping instead of extending it. */
  replace?: boolean;
  mapping?: ConsentModeMapping;
  /** Category values used by the standalone default and inline helpers. */
  categories?: Readonly<Record<string, boolean>>;
}
export type ConsentModeDefault = Record<ConsentModeSignal, ConsentModeValue> & {
  wait_for_update: number;
  region?: readonly string[];
};
export interface ConsentModeController {
  stop(): void;
}

const signals: readonly ConsentModeSignal[] = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
  "functionality_storage",
  "personalization_storage",
  "security_storage",
];
const signalSet = new Set<string>(signals);
const defaultMapping: ConsentModeMapping = {
  analytics: ["analytics_storage"],
  marketing: ["ad_storage", "ad_user_data", "ad_personalization"],
  advertising: ["ad_storage", "ad_user_data", "ad_personalization"],
  functional: ["functionality_storage", "personalization_storage"],
  preferences: ["functionality_storage", "personalization_storage"],
  necessary: ["security_storage"],
};
const development = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
function invalid(message: string): void {
  if (development())
    throw new TypeError(`Invalid Consent Mode options: ${message}`);
  console.warn(`CookieChimp ignored invalid Consent Mode options: ${message}`);
}

function normalize(
  options: ConsentModeOptions,
): Required<Pick<ConsentModeOptions, "wait_for_update">> & ConsentModeOptions {
  let wait = options.wait_for_update ?? 500;
  if (!Number.isFinite(wait) || wait < 0) {
    invalid("wait_for_update must be a non-negative finite number");
    wait = 500;
  }
  let region = options.region;
  if (
    region !== undefined &&
    (!Array.isArray(region) ||
      region.some(
        (code) =>
          typeof code !== "string" ||
          !/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(code),
      ))
  ) {
    invalid("region must contain ISO region codes");
    region = undefined;
  }
  for (const key of ["ads_data_redaction", "url_passthrough"] as const) {
    if (options[key] !== undefined && typeof options[key] !== "boolean") {
      invalid(`${key} must be a boolean`);
      options = { ...options, [key]: undefined };
    }
  }
  let mapping = options.mapping;
  if (
    mapping !== undefined &&
    (typeof mapping !== "object" ||
      mapping === null ||
      Array.isArray(mapping) ||
      Object.entries(mapping).some(
        ([category, values]) =>
          !category ||
          (values !== null &&
            (!Array.isArray(values) ||
              values.some((value) => !signalSet.has(value)))),
      ))
  ) {
    invalid("mapping must map category names to Consent Mode signal arrays");
    mapping = undefined;
  }
  return {
    ...options,
    wait_for_update: wait,
    ...(region ? { region } : { region: undefined }),
    mapping,
  };
}

function values(
  categories: Readonly<Record<string, boolean>>,
  mapping?: ConsentModeMapping,
  replace?: boolean,
) {
  const result = Object.fromEntries(
    signals.map((signal) => [signal, "denied"]),
  ) as Record<ConsentModeSignal, ConsentModeValue>;
  const effective = replace
    ? { ...mapping }
    : { ...defaultMapping, ...mapping };
  for (const [category, mapped] of Object.entries(effective)) {
    if (!mapped) continue;
    const granted = category === "necessary" || categories[category] === true;
    if (granted) for (const signal of mapped) result[signal] = "granted";
  }
  result.security_storage = "granted";
  return result;
}

/** Build the object passed to `gtag('consent', 'default', ...)`. */
export function consentModeDefault(
  options: ConsentModeOptions = {},
): ConsentModeDefault {
  const checked = normalize(options);
  return {
    ...values(checked.categories ?? {}, checked.mapping, checked.replace),
    wait_for_update: checked.wait_for_update,
    ...(checked.region ? { region: [...checked.region] } : {}),
  };
}

type ConsentSource = Pick<ConsentState, "categories">;
type ConsentRuntime = {
  get(): ConsentSource;
  subscribe(listener: (state: ConsentSource) => void): () => void;
  readonly needsDecision?: boolean;
};
type Gtag = (...args: unknown[]) => void;

/** Install the synchronous default and keep Google signals in sync with consent. */
export function installConsentMode(
  consent: ConsentRuntime,
  options: ConsentModeOptions = {},
): ConsentModeController {
  if (typeof window === "undefined") return { stop() {} };
  if (
    !consent ||
    typeof consent.get !== "function" ||
    typeof consent.subscribe !== "function"
  ) {
    invalid("consent must provide get and subscribe");
    return { stop() {} };
  }
  const checked = normalize(options);
  const target = window as typeof window & {
    dataLayer?: unknown[][];
    gtag?: Gtag;
    __ccConsentModeDefault?: boolean;
  };
  target.dataLayer ??= [];
  target.gtag ??= function () {
    // biome-ignore lint/complexity/noArguments: Google's public gtag shim queues its Arguments object.
    target.dataLayer?.push(arguments as unknown as unknown[]);
  };
  const gtag = target.gtag;
  const returning = consent.needsDecision === false;
  let last = values(checked.categories ?? {}, checked.mapping, checked.replace);
  if (checked.default !== false && !target.__ccConsentModeDefault) {
    gtag("consent", "default", {
      ...last,
      wait_for_update: checked.wait_for_update,
      ...(checked.region ? { region: checked.region } : {}),
    });
    target.__ccConsentModeDefault = true;
  }
  if (checked.ads_data_redaction !== undefined)
    gtag("set", "ads_data_redaction", checked.ads_data_redaction);
  if (checked.url_passthrough !== undefined)
    gtag("set", "url_passthrough", checked.url_passthrough);
  const update = (next: ConsentSource) => {
    const nextValues = values(
      next.categories,
      checked.mapping,
      checked.replace,
    );
    if (signals.every((signal) => nextValues[signal] === last[signal])) return;
    last = nextValues;
    gtag("consent", "update", nextValues);
  };
  if (returning) {
    const stored = values(
      consent.get().categories,
      checked.mapping,
      checked.replace,
    );
    gtag("consent", "update", stored);
    last = stored;
  }
  const unsubscribe = consent.subscribe(update);
  let stopped = false;
  return {
    stop() {
      if (!stopped) {
        stopped = true;
        unsubscribe();
      }
    },
  };
}

/** Return a CSP-friendly inline head script that establishes Consent Mode immediately. */
export function consentModeInlineScript(
  options: ConsentModeOptions = {},
): string {
  const checked = normalize(options);
  const commands: unknown[][] = [
    ["consent", "default", consentModeDefault(checked)],
  ];
  if (checked.ads_data_redaction !== undefined)
    commands.push(["set", "ads_data_redaction", checked.ads_data_redaction]);
  if (checked.url_passthrough !== undefined)
    commands.push(["set", "url_passthrough", checked.url_passthrough]);
  const json = inlineJson(commands);
  return `(function(w){w.dataLayer=w.dataLayer||[];w.gtag=w.gtag||function(){w.dataLayer.push(arguments)};var c=${json};for(var i=0;i<c.length;i++)w.gtag.apply(w,c[i]);w.__ccConsentModeDefault=true})(window);`;
}
