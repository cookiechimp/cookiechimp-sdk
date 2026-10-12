export type GoogleSignal =
  | "analytics_storage"
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization";
export type ConsentModeMapping = Record<string, readonly GoogleSignal[] | null>;
export interface ConsentModeOptions {
  mapping?: ConsentModeMapping;
  [option: string]: unknown;
}
export interface ServiceConfig {
  id: string;
  category: string;
  name?: string;
  scripts?: readonly (string | RegExp)[];
  cookies?: readonly (string | RegExp)[];
  domains?: readonly (string | RegExp)[];
  default?: boolean;
}
export interface ConfigInput {
  categories?: unknown;
  services?: readonly ServiceConfig[];
  [option: string]: unknown;
}
export interface PresetScript {
  src: string;
  attributes: Readonly<Record<string, string>>;
  nonce?: string;
}
export interface QueueTarget {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}
export interface QueueStub {
  dataLayerName: string;
  install(target?: QueueTarget): (...args: unknown[]) => void;
}
/** The part of a core consent runtime that preset consent sync reads. */
export interface ConsentSource {
  get(): { categories: Readonly<Record<string, boolean>> };
  subscribe(
    listener: (state: {
      categories: Readonly<Record<string, boolean>>;
    }) => void,
  ): () => void;
}
export interface ScriptPreset {
  id: string;
  category: string;
  service: ServiceConfig;
  consentMode: ConsentModeMapping;
  script: PresetScript;
  queue: QueueStub;
  load: "gated" | "immediate";
  /**
   * How a revoke reaches a vendor script that already loaded: `"api"` calls the
   * vendor's own consent API, `"reload"` means only a page reload stops it.
   */
  revoke?: "api" | "reload";
  /** Keep the vendor consent API in step with this preset's category. Returns an unsubscribe. */
  sync?(consent: ConsentSource, target?: object): () => void;
}
export type PresetConfig = ConfigInput & { consentMode?: ConsentModeOptions };

/** Add preset services and merge their category signal mappings into a config. */
export function applyPresets<T extends PresetConfig>(
  config: T,
  presets: readonly ScriptPreset[],
): T & { services: ServiceConfig[]; consentMode: ConsentModeOptions } {
  const mapping: ConsentModeMapping = { ...config.consentMode?.mapping };
  for (const preset of presets) {
    for (const [category, signals] of Object.entries(preset.consentMode)) {
      const current = mapping[category] ?? [];
      mapping[category] =
        signals === null ? null : [...new Set([...current, ...signals])];
    }
  }
  return {
    ...config,
    services: [
      ...(config.services ?? []),
      ...presets.map((preset) => preset.service),
    ],
    consentMode: { ...config.consentMode, mapping },
  };
}
