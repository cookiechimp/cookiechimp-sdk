/** The current CookieChimp SDK package version. */
export const VERSION = "0.0.0";

export const CONSENT_COOKIE_NAME = "cc_consent";
export const CONSENT_SCHEMA_VERSION = 1 as const;

import {
  type CategoriesInput,
  type CategoryInput,
  type ConfigInput,
  isDevelopment,
  type NormalizedConfig,
  normalizeConfig,
} from "./config";
import type { Region, Regulation } from "./regions";

export type {
  CategoryConfig,
  ConfigInput,
  NormalizedCategoryConfig,
  NormalizedConfig,
  NormalizedServiceConfig,
  ServiceConfig,
  ServicePattern,
} from "./config";
export { ConsentConfigError, normalizeConfig } from "./config";
export type { Region, Regulation } from "./regions";

/** Read browser Global Privacy Control. Use the regions subpath for headers. */
export function readGpc(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

export type ConsentAction = "accept_all" | "reject_all" | "custom" | "gpc_auto";

export interface ConsentRecord {
  consentId: string;
  ts: string;
  categories: Record<string, boolean>;
  services?: Record<string, boolean>;
  action: ConsentAction;
  region?: Region | null;
  regulation?: Regulation;
  gpc?: boolean;
}

export interface ConsentState extends ConsentRecord {
  schemaVersion: typeof CONSENT_SCHEMA_VERSION;
}

export interface ConsentCategory {
  name: string;
  default?: boolean;
}

export type ConsentCategories =
  | CategoriesInput
  | readonly (string | ConsentCategory | CategoryInput)[];

export interface ConsentCookieOptions {
  /** Lifetime in seconds. Defaults to 180 days. */
  maxAge?: number;
  domain?: string;
  secure?: boolean;
}

export interface ConsentConfig extends ConfigInput {
  categories: ConsentCategories;
  cookie?: ConsentCookieOptions;
  initial?: ConsentState | null;
  language?: string;
  onConsent?: (record: ConsentRecord) => void;
  /** Region supplied by server rendering or application configuration. */
  region?: Region | null;
  /** Override browser GPC detection, useful for server-provided context. */
  gpc?: boolean;
  /** Categories treated as sale/share for GPC. */
  saleShareCategories?: readonly string[];
  forceDecision?: boolean;
}

export interface ConsentRuntime {
  get(): ConsentState;
  set(
    partial:
      | Readonly<Record<string, boolean>>
      | {
          categories?: Readonly<Record<string, boolean>>;
          services?: Readonly<Record<string, boolean>>;
        },
  ): ConsentState;
  acceptAll(): ConsentState;
  rejectAll(): ConsentState;
  subscribe(listener: (state: ConsentState) => void): () => void;
  has(category: string): boolean;
  hasService(service: string): boolean;
  readonly region: Region | null;
  readonly regulation: Regulation;
  readonly gpc: boolean;
  readonly needsDecision: boolean;
  readonly showOptOut: boolean;
  readonly language: string;
}

const MAX_COOKIE_VALUE_LENGTH = 3800;
const encoder = new TextEncoder();
const decoder = new TextDecoder(undefined, { fatal: true });

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validState(value: unknown): ConsentState | null {
  if (!isRecord(value) || value.schemaVersion !== CONSENT_SCHEMA_VERSION)
    return null;
  if (
    typeof value.consentId !== "string" ||
    !/^[A-Za-z0-9_-]{16,64}$/.test(value.consentId) ||
    typeof value.ts !== "string" ||
    Number.isNaN(Date.parse(value.ts)) ||
    !["accept_all", "reject_all", "custom", "gpc_auto"].includes(
      value.action as string,
    ) ||
    !isRecord(value.categories)
  )
    return null;

  const categories: Record<string, boolean> = {};
  for (const [name, enabled] of Object.entries(value.categories)) {
    if (!name || typeof enabled !== "boolean") return null;
    categories[name] = enabled;
  }
  if (categories.necessary !== true) return null;
  let services: Record<string, boolean> | undefined;
  if (value.services !== undefined) {
    if (!isRecord(value.services)) return null;
    services = {};
    for (const [id, enabled] of Object.entries(value.services)) {
      if (!id || typeof enabled !== "boolean") return null;
      services[id] = enabled;
    }
  }
  return {
    schemaVersion: CONSENT_SCHEMA_VERSION,
    consentId: value.consentId,
    ts: value.ts,
    categories,
    ...(services ? { services } : {}),
    action: value.action as ConsentAction,
    ...(isRecord(value.region) && typeof value.region.country === "string"
      ? { region: value.region as unknown as Region }
      : value.region === null
        ? { region: null }
        : {}),
    ...(["gdpr", "ccpa", "none"].includes(value.regulation as string)
      ? { regulation: value.regulation as Regulation }
      : {}),
    ...(typeof value.gpc === "boolean" ? { gpc: value.gpc } : {}),
  };
}

/** Encode consent for storage in the versioned first-party cookie. */
export function encodeConsentCookie(state: ConsentState): string {
  return `v1.${toBase64Url(encoder.encode(JSON.stringify(state)))}`;
}

/** Decode an unescaped cookie value. Invalid input is ignored without throwing. */
export function decodeConsentCookie(value: string): ConsentState | null {
  if (typeof value !== "string" || value.length > MAX_COOKIE_VALUE_LENGTH)
    return null;
  const separator = value.indexOf(".");
  if (separator < 0 || value.slice(0, separator) !== "v1") return null;
  const bytes = fromBase64Url(value.slice(separator + 1));
  if (!bytes || bytes.byteLength > MAX_COOKIE_VALUE_LENGTH) return null;
  try {
    return validState(JSON.parse(decoder.decode(bytes)));
  } catch {
    return null;
  }
}

/** Read Cookie header text in an SSR environment. */
export function readConsentCookie(
  header: string | null | undefined,
): ConsentState | null {
  if (!header || header.length > 32_768) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (
      separator < 0 ||
      part.slice(0, separator).trim() !== CONSENT_COOKIE_NAME
    )
      continue;
    try {
      return decodeConsentCookie(
        decodeURIComponent(part.slice(separator + 1).trim()),
      );
    } catch {
      return null;
    }
  }
  return null;
}

export function createEmitter<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    subscribe(listener: (value: T) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(value: T) {
      for (const listener of [...listeners]) {
        try {
          listener(value);
        } catch {
          // A consumer callback must not prevent delivery to other consumers.
        }
      }
    },
  };
}

function categoryDefaults(config: NormalizedConfig): Record<string, boolean> {
  return Object.fromEntries(
    config.categories.map(({ id, default: enabled }) => [id, enabled]),
  );
}

function newConsentId(): string {
  if (typeof globalThis.crypto.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function snapshot(state: ConsentState): ConsentState {
  return Object.freeze({
    ...state,
    categories: Object.freeze({ ...state.categories }),
    ...(state.services
      ? { services: Object.freeze({ ...state.services }) }
      : {}),
  });
}

function validateCookieOptions(options: ConsentCookieOptions): void {
  if (
    options.domain !== undefined &&
    (/[;\s]/.test(options.domain) ||
      [...options.domain].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      }))
  )
    throw new TypeError(
      "Invalid cookie.domain: domains cannot contain semicolons, whitespace, or control characters",
    );
}

function persist(state: ConsentState, options: ConsentCookieOptions): void {
  if (typeof document === "undefined") return;
  const maxAge = options.maxAge ?? 180 * 24 * 60 * 60;
  const fields = [
    `${CONSENT_COOKIE_NAME}=${encodeURIComponent(encodeConsentCookie(state))}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (options.domain) fields.push(`Domain=${options.domain}`);
  const secure = options.secure ?? globalThis.location?.protocol === "https:";
  if (secure) fields.push("Secure");
  // biome-ignore lint/suspicious/noDocumentCookie: document.cookie is the required broadly supported cookie writer.
  document.cookie = fields.join("; ");
}

export function createConsent(config: ConsentConfig): ConsentRuntime {
  validateCookieOptions(config.cookie ?? {});
  const normalized = normalizeConfig(config);
  const configuredDefaults = categoryDefaults(normalized);
  const region = config.region ?? config.initial?.region ?? null;
  const regionKey = region
    ? `${region.country}${region.region ? `-${region.region}` : ""}`
    : "";
  if (
    isDevelopment() &&
    region &&
    config.regulation === undefined &&
    config.resolveRegulation === undefined
  )
    console.warn(
      "CookieChimp received a region without resolveRegulation; using configured overrides or fallbackRegulation",
    );
  const regulation =
    (typeof normalized.regulation === "function"
      ? normalized.regulation(region)
      : normalized.regulation) ??
    normalized.regions[regionKey] ??
    (region ? normalized.regions[region.country] : undefined) ??
    normalized.resolveRegulation?.(region, normalized.now) ??
    normalized.fallbackRegulation;
  const gpc = config.gpc ?? (readGpc() || config.initial?.gpc === true);
  const defaults = Object.fromEntries(
    Object.entries(configuredDefaults).map(([name, enabled]) => [
      name,
      name === "necessary"
        ? true
        : regulation === "gdpr"
          ? false
          : regulation === "ccpa"
            ? true
            : enabled,
    ]),
  );
  const serviceCategories = Object.fromEntries(
    normalized.services.map(({ id, category }) => [id, category]),
  );
  const browserState =
    typeof document === "undefined" ? null : readConsentCookie(document.cookie);
  const restored = validState(config.initial) ?? browserState;
  const saleShare = new Set(
    config.saleShareCategories ?? ["advertising", "marketing"],
  );
  const mustApplyGpc =
    regulation === "ccpa" &&
    gpc &&
    (!restored?.gpc ||
      [...saleShare].some(
        (category) => restored.categories[category] === true,
      ));
  let state: ConsentState = restored
    ? {
        ...restored,
        categories: { ...defaults, ...restored.categories, necessary: true },
        ...(restored.services ? { services: { ...restored.services } } : {}),
      }
    : {
        schemaVersion: CONSENT_SCHEMA_VERSION,
        consentId: newConsentId(),
        ts: new Date().toISOString(),
        categories: defaults,
        action: "custom",
        region,
        regulation,
        gpc,
      };
  state = { ...state, region, regulation, gpc };
  if (regulation === "ccpa" && gpc) {
    state.categories = Object.fromEntries(
      Object.entries(state.categories).map(([name, enabled]) => [
        name,
        saleShare.has(name) ? false : enabled,
      ]),
    );
    if (mustApplyGpc) state.action = "gpc_auto";
  }
  const emitter = createEmitter<ConsentState>();
  let decided = restored !== null || mustApplyGpc;
  let current = snapshot(state);

  const decide = (
    categories: Record<string, boolean>,
    action: ConsentAction,
    services = state.services,
  ): ConsentState => {
    const compliantCategories =
      regulation === "ccpa" && gpc
        ? Object.fromEntries(
            Object.entries(categories).map(([name, enabled]) => [
              name,
              saleShare.has(name) ? false : enabled,
            ]),
          )
        : categories;
    state = {
      ...state,
      ts: new Date().toISOString(),
      categories: { ...compliantCategories, necessary: true },
      ...(services && Object.keys(services).length ? { services } : {}),
      action,
      region,
      regulation,
      gpc,
    };
    decided = true;
    persist(state, config.cookie ?? {});
    const result = snapshot(state);
    current = result;
    emitter.emit(result);
    const { schemaVersion: _, ...record } = state;
    config.onConsent?.(record);
    return result;
  };

  if (mustApplyGpc) {
    persist(state, config.cookie ?? {});
    const { schemaVersion: _, ...record } = state;
    config.onConsent?.(record);
  }

  return {
    get: () => current,
    set: (partial) => {
      const structured =
        isRecord(partial.categories) || isRecord(partial.services);
      const categoryPartial = structured
        ? (partial.categories ?? {})
        : (partial as Readonly<Record<string, boolean>>);
      const servicePartial = structured ? (partial.services ?? {}) : {};
      const allowed = Object.fromEntries(
        Object.entries(categoryPartial).filter(
          ([name, enabled]) => name in defaults && typeof enabled === "boolean",
        ),
      );
      const allowedServices = Object.fromEntries(
        Object.entries(servicePartial).filter(
          ([id, enabled]) =>
            id in serviceCategories && typeof enabled === "boolean",
        ),
      );
      return decide({ ...state.categories, ...allowed }, "custom", {
        ...state.services,
        ...allowedServices,
      });
    },
    acceptAll: () =>
      decide(
        Object.fromEntries(Object.keys(defaults).map((name) => [name, true])),
        "accept_all",
        Object.fromEntries(normalized.services.map(({ id }) => [id, true])),
      ),
    rejectAll: () =>
      decide(
        Object.fromEntries(
          Object.keys(defaults).map((name) => [name, name === "necessary"]),
        ),
        "reject_all",
        Object.fromEntries(
          normalized.services.map(({ id, category }) => [
            id,
            category === "necessary",
          ]),
        ),
      ),
    subscribe: emitter.subscribe,
    has: (category) => state.categories[category] === true,
    hasService: (service) => {
      const category = serviceCategories[service];
      if (!category) return false;
      return state.services?.[service] ?? state.categories[category] === true;
    },
    region,
    regulation,
    gpc,
    get needsDecision() {
      return (
        config.forceDecision === true || (regulation === "gdpr" && !decided)
      );
    },
    showOptOut: regulation === "ccpa",
    language: config.language ?? "en",
  };
}
