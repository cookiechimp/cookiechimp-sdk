/** The current CookieChimp SDK package version. */
export const VERSION = "0.0.0";

export const CONSENT_COOKIE_NAME = "cc_consent";
export const CONSENT_SCHEMA_VERSION = 1 as const;

export type ConsentAction = "accept_all" | "reject_all" | "custom" | "gpc_auto";

export interface ConsentRecord {
  consentId: string;
  ts: string;
  categories: Record<string, boolean>;
  action: ConsentAction;
}

export interface ConsentState extends ConsentRecord {
  schemaVersion: typeof CONSENT_SCHEMA_VERSION;
}

export interface ConsentCategory {
  name: string;
  default?: boolean;
}

export type ConsentCategories =
  | Record<string, boolean>
  | readonly (string | ConsentCategory)[];

export interface ConsentCookieOptions {
  /** Lifetime in seconds. Defaults to 180 days. */
  maxAge?: number;
  domain?: string;
  secure?: boolean;
}

export interface ConsentConfig {
  categories: ConsentCategories;
  cookie?: ConsentCookieOptions;
  initial?: ConsentState | null;
  language?: string;
  onConsent?: (record: ConsentRecord) => void;
}

export interface ConsentRuntime {
  get(): ConsentState;
  set(partial: Readonly<Record<string, boolean>>): ConsentState;
  acceptAll(): ConsentState;
  rejectAll(): ConsentState;
  subscribe(listener: (state: ConsentState) => void): () => void;
  has(category: string): boolean;
  readonly region: null;
  readonly regulation: "none";
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
  return {
    schemaVersion: CONSENT_SCHEMA_VERSION,
    consentId: value.consentId,
    ts: value.ts,
    categories,
    action: value.action as ConsentAction,
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

function categoryDefaults(config: ConsentCategories): Record<string, boolean> {
  const result: Record<string, boolean> = { necessary: true };
  if (Array.isArray(config)) {
    for (const item of config) {
      const name = typeof item === "string" ? item : item.name;
      if (name)
        result[name] =
          name === "necessary" ||
          (typeof item !== "string" && item.default === true);
    }
  } else {
    for (const [name, enabled] of Object.entries(config))
      if (name) result[name] = name === "necessary" || enabled;
  }
  result.necessary = true;
  return result;
}

function newConsentId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
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
  const defaults = categoryDefaults(config.categories);
  const browserState =
    typeof document === "undefined" ? null : readConsentCookie(document.cookie);
  const restored = validState(config.initial) ?? browserState;
  let state: ConsentState = restored
    ? {
        ...restored,
        categories: { ...defaults, ...restored.categories, necessary: true },
      }
    : {
        schemaVersion: CONSENT_SCHEMA_VERSION,
        consentId: newConsentId(),
        ts: new Date().toISOString(),
        categories: defaults,
        action: "custom",
      };
  const emitter = createEmitter<ConsentState>();

  const decide = (
    categories: Record<string, boolean>,
    action: ConsentAction,
  ): ConsentState => {
    state = {
      ...state,
      ts: new Date().toISOString(),
      categories: { ...categories, necessary: true },
      action,
    };
    persist(state, config.cookie ?? {});
    emitter.emit(state);
    const { schemaVersion: _, ...record } = state;
    config.onConsent?.(record);
    return state;
  };

  return {
    get: () => state,
    set: (partial) => {
      const allowed = Object.fromEntries(
        Object.entries(partial).filter(([name]) => name in defaults),
      );
      return decide({ ...state.categories, ...allowed }, "custom");
    },
    acceptAll: () =>
      decide(
        Object.fromEntries(Object.keys(defaults).map((name) => [name, true])),
        "accept_all",
      ),
    rejectAll: () =>
      decide(
        Object.fromEntries(
          Object.keys(defaults).map((name) => [name, name === "necessary"]),
        ),
        "reject_all",
      ),
    subscribe: emitter.subscribe,
    has: (category) => state.categories[category] === true,
    region: null,
    regulation: "none",
    language: config.language ?? "en",
  };
}
