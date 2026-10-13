import {
  type CategoryConfig,
  type ConfigInput,
  categoryRecords,
  type NormalizedConfig,
  normalizeConfig,
  type ServiceConfig,
} from "./config";

function mergeById<T extends { id: string }>(
  ...sets: readonly (readonly T[] | undefined)[]
): T[] {
  const merged = new Map<string, T>();
  for (const set of sets)
    for (const item of set ?? [])
      merged.set(item.id, { ...merged.get(item.id), ...item });
  return [...merged.values()];
}

/** Merge local defaults, dashboard values and explicit code overrides. */
export function mergeConfig(
  defaults: ConfigInput,
  dashboard?: ConfigInput,
  override?: ConfigInput,
): NormalizedConfig {
  return normalizeConfig({
    categories: mergeById(
      categoryRecords(defaults.categories),
      categoryRecords(dashboard?.categories),
      categoryRecords(override?.categories),
    ),
    services: mergeById(
      defaults.services,
      dashboard?.services,
      override?.services,
    ),
  });
}

/** Return a compact category-version key independent of declaration order. */
export function categoriesHash(config: ConfigInput | NormalizedConfig): string {
  const categories = normalizeConfig(config)
    .categories.map(({ id, required, default: enabled, label, description }) =>
      JSON.stringify([id, required, enabled, label ?? "", description ?? ""]),
    )
    .sort();
  let hash = 0x811c9dc5;
  const text = categories.join("|");
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

const DEFAULT_API = "https://cookiechimp.com";
const MAX_BYTES = 524288;
const ID = /^[\w-]{1,64}$/;
const KEY = /^cc_pk_[\w-]{8,128}$/;

type Json = Record<string, unknown>;

/** The SDK view of one platform offline bundle, for one banner and language. */
export interface DashboardConfig {
  schemaVersion: 1;
  /** Platform `cache_version`, also the ETag value. */
  configVersion: string;
  etag: string;
  /** Platform `version` (account config revision). */
  revision?: number;
  accountId: string;
  bannerId: string;
  consentMode?: string;
  language: string;
  categories: CategoryConfig[];
  services: ServiceConfig[];
  /** SDK service id (slug of the unique platform service name) to platform service hashid. */
  serviceIds: Record<string, string>;
  /** `translations[banner][language]`: consent_modal, preferences_modal, privacy_policy_url. */
  copy: Json;
  /** Every language of the selected banner. */
  translations: Json;
  /** Platform `country_banner_map`. */
  regions: Json;
  theme: Json;
  /** Selected banner settings (gui_options, buttons, footer, revision and so on). */
  banner: Json;
  integrations: Json;
  cookie: Json;
  reconsentRequiredAt?: string;
  updatedAt?: string;
}

export type ConfigSource = "local" | "cache" | "dashboard";

export interface SyncState {
  config: NormalizedConfig;
  dashboard?: DashboardConfig;
  source: ConfigSource;
  status: "idle" | "loading" | "ready" | "error" | "disabled";
  error?: string;
  /** True when categories or the re-consent date changed since the cached version. */
  categoriesChanged: boolean;
}

export interface SyncOptions {
  /** Platform account hashid. */
  projectId: string;
  /** Optional publishable key (`cc_pk_...`). Secret keys are refused. */
  publishableKey?: string;
  defaults?: ConfigInput;
  override?: ConfigInput;
  /** Selects the banner language, for example `fr-CA` (base language `fr`). */
  locale?: string;
  /** Selects the banner from `country_banner_map`, for example `US-CA`. */
  region?: string;
  /** Platform origin. Defaults to https://cookiechimp.com. */
  apiBase?: string;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  fetch?: typeof fetch;
  /** Abort a revalidation after this many milliseconds. Defaults to 5000. */
  timeoutMs?: number;
  /** Revalidate automatically in idle time after creation. Defaults to true. */
  revalidate?: boolean;
  /** Report category and re-consent changes. Defaults to true. */
  reprompt?: boolean;
}

export interface SyncClient {
  get(): SyncState;
  subscribe(listener: (state: SyncState) => void): () => void;
  revalidate(): Promise<SyncState>;
  destroy(): void;
}

const isDev = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const record = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const object = (value: unknown): Json => (record(value) ? value : {});
const own = (value: unknown, key: unknown): unknown =>
  record(value) && typeof key === "string" && Object.hasOwn(value, key)
    ? value[key]
    : undefined;
const text = (value: unknown, max = 512) =>
  typeof value === "string" && value.length <= max ? value : undefined;
const flag = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;
const pick = <T extends object>(entries: [string, unknown][]) =>
  Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as T;
const array = (value: unknown) => (Array.isArray(value) ? value : []);
const slug = (value: unknown) =>
  text(value, 128)
    ?.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || undefined;

/** Parse JSON, dropping `__proto__`, `constructor` and `prototype` keys at every depth. */
export const safeJson = (body: string): unknown =>
  JSON.parse(body, (key, value) =>
    key === "__proto__" || key === "constructor" || key === "prototype"
      ? undefined
      : value,
  );

/**
 * Adapt an untrusted platform offline bundle
 * (`GET /api/v1/mobile-sdk/offline/:account_hashid`) to the SDK config layer.
 */
export function adaptPlatformConfig(
  value: unknown,
  options: { projectId?: string; locale?: string; region?: string } = {},
): DashboardConfig | undefined {
  if (!record(value)) return;
  const schema = value.schema_version;
  const configVersion = text(value.cache_version, 128);
  const accountId = text(value.account_hashid, 64);
  if (
    (schema !== undefined && schema !== 1) ||
    !configVersion ||
    !accountId ||
    (options.projectId !== undefined && accountId !== options.projectId)
  )
    return;
  const map = object(value.country_banner_map);
  const region = options.region?.toUpperCase();
  const bannerId = [
    own(map, region),
    own(map, region?.split("-")[0]),
    value.default_banner,
  ].find((id) => text(id, 64) && record(own(value.banners, id))) as
    | string
    | undefined;
  if (!bannerId) return;
  const banner = own(value.banners, bannerId) as Json;
  const translations = object(own(value.translations, bannerId));
  const wanted = options.locale?.split("-")[0]?.toLowerCase();
  const language = [wanted, ...array(banner.available_languages)]
    .concat(Object.keys(translations))
    .find((code) => text(code, 16) && record(own(translations, code))) as
    | string
    | undefined;
  const consentMode = text(banner.consent_mode, 32);
  const localized = (item: Json) => {
    const entry = object(own(item.translations, language));
    return {
      label: text(entry.name) ?? text(item.name),
      description:
        text(entry.description, 4096) ?? text(item.description, 4096),
    };
  };
  const categories: CategoryConfig[] = [];
  const services: ServiceConfig[] = [];
  const serviceIds: Record<string, string> = {};
  for (const category of array(value.categories)) {
    const id = record(category) && slug(category.slug);
    if (!id) continue;
    const required = category.required === true;
    categories.push(
      pick([
        ["id", id],
        ["required", required],
        ["default", required || consentMode === "opt_out"],
        ...Object.entries(localized(category)),
      ]),
    );
    for (const service of array(category.services)) {
      const serviceId = record(service) && slug(service.name);
      if (!serviceId || Object.hasOwn(serviceIds, serviceId)) continue;
      serviceIds[serviceId] = text(service.id, 64) ?? "";
      const cookies = array(service.storage_items)
        .filter((item) => record(item) && item.type === "cookie")
        .map((item) => text((item as Json).name, 256))
        .filter((name): name is string => !!name);
      services.push(
        pick([
          ["id", serviceId],
          ["category", id],
          ["name", localized(service).label],
          ["cookies", cookies.length ? cookies : undefined],
          ["default", flag(service.accepted_by_default)],
        ]),
      );
    }
  }
  const revision = value.version;
  return pick<DashboardConfig>([
    ["schemaVersion", 1],
    ["configVersion", configVersion],
    ["etag", `"${configVersion}"`],
    ["revision", Number.isInteger(revision) ? revision : undefined],
    ["accountId", accountId],
    ["bannerId", bannerId],
    ["consentMode", consentMode],
    ["language", language ?? ""],
    ["categories", categories],
    ["services", services],
    ["serviceIds", serviceIds],
    ["copy", object(own(translations, language))],
    ["translations", translations],
    ["regions", map],
    ["theme", object(banner.theme)],
    ["banner", banner],
    ["integrations", object(value.integrations)],
    ["cookie", object(value.cookie_settings)],
    ["reconsentRequiredAt", text(value.reconsent_required_at, 64)],
    ["updatedAt", text(value.updated_at, 64)],
  ]);
}

const layer = (dashboard?: DashboardConfig): ConfigInput | undefined =>
  dashboard && {
    categories: dashboard.categories,
    services: dashboard.services,
  };

function apiUrl(base: string): string | undefined {
  try {
    const url = new URL(base);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    if (url.username || url.password || url.search || url.hash) return;
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" && local && isDev())
    )
      return url.href.replace(/\/$/, "");
  } catch {}
}

/** Create the connected-mode config client: cache first, revalidate in idle time. */
export function createSync(options: SyncOptions): SyncClient {
  const defaults = options.defaults ?? {};
  const base = apiUrl(options.apiBase ?? DEFAULT_API);
  const key = options.publishableKey;
  const problem = !ID.test(options.projectId)
    ? "invalid projectId"
    : key?.startsWith("cc_sk_")
      ? "secret keys must never be used in the browser"
      : key !== undefined && !KEY.test(key)
        ? "invalid publishable key"
        : !base
          ? "apiBase must be https"
          : undefined;
  if (problem && isDev()) throw new TypeError(`CookieChimp sync: ${problem}`);
  let storage: SyncOptions["storage"];
  try {
    storage =
      options.storage === undefined ? globalThis.localStorage : options.storage;
  } catch {}
  const pointer = `cc_config:${options.projectId}`;
  const listeners = new Set<(state: SyncState) => void>();
  const controller = new AbortController();
  let pending: Promise<SyncState> | undefined;
  let destroyed = false;

  /** Parse and adapt an untrusted body; returns the sanitised JSON to cache. */
  const adapt = (body: string): [DashboardConfig, string] | undefined => {
    try {
      if (body.length > MAX_BYTES) return;
      const value = safeJson(body);
      const parsed = adaptPlatformConfig(value, options);
      return parsed && [parsed, JSON.stringify(value)];
    } catch {}
  };
  const build = (
    dashboard: DashboardConfig | undefined,
    source: ConfigSource,
    status: SyncState["status"],
    categoriesChanged = false,
    error?: string,
  ): SyncState | undefined => {
    try {
      return pick<SyncState>([
        ["config", mergeConfig(defaults, layer(dashboard), options.override)],
        ["dashboard", dashboard],
        ["source", dashboard ? source : "local"],
        ["status", status],
        ["error", error],
        ["categoriesChanged", categoriesChanged],
      ]);
    } catch {}
  };
  const local = (status: SyncState["status"], error?: string) =>
    build(undefined, "local", status, false, error) as SyncState;

  const readCache = () => {
    try {
      const version = storage?.getItem(pointer);
      const raw = version && storage?.getItem(`${pointer}:${version}`);
      const parsed = raw ? adapt(raw)?.[0] : undefined;
      return parsed?.configVersion === version ? parsed : undefined;
    } catch {}
  };
  const cached = problem ? undefined : readCache();
  let state: SyncState = problem
    ? local("disabled", problem)
    : (cached && build(cached, "cache", "idle")) || local("idle");

  const emit = (next: SyncState) => {
    state = next;
    if (!destroyed) for (const listener of listeners) listener(next);
    return next;
  };
  const writeCache = (version: string, body: string) => {
    try {
      const previous = storage?.getItem(pointer);
      storage?.setItem(`${pointer}:${version}`, body);
      storage?.setItem(pointer, version);
      if (previous && previous !== version)
        storage?.removeItem(`${pointer}:${previous}`);
    } catch {}
  };
  const failed = (error: string) => emit({ ...state, status: "error", error });
  const hash = (dashboard: DashboardConfig) =>
    categoriesHash(mergeConfig(defaults, layer(dashboard), options.override)) +
    (dashboard.reconsentRequiredAt ?? "");

  const run = async (): Promise<SyncState> => {
    const doFetch = options.fetch ?? globalThis.fetch;
    if (!doFetch) return failed("fetch unavailable");
    const current = state.dashboard;
    emit({ ...state, status: "loading" });
    const headers: Record<string, string> = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    if (current) headers["If-None-Match"] = current.etag;
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    const timer = setTimeout(abort, options.timeoutMs ?? 5000);
    controller.signal.addEventListener("abort", abort);
    try {
      const response = await doFetch(
        `${base}/api/v1/mobile-sdk/offline/${options.projectId}`,
        {
          headers,
          credentials: "omit",
          redirect: "error",
          signal: timeout.signal,
        },
      );
      if (response.status === 304 && current)
        return emit({ ...state, source: "dashboard", status: "ready" });
      if (!response.ok) return failed(`HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > MAX_BYTES) return failed("config too large");
      const adapted = adapt(body);
      if (!adapted) return failed("invalid config");
      const [parsed, clean] = adapted;
      const changed =
        options.reprompt !== false &&
        !!current &&
        hash(current) !== hash(parsed);
      const next = build(parsed, "dashboard", "ready", changed);
      if (!next) return failed("invalid config");
      writeCache(parsed.configVersion, clean);
      return emit(next);
    } catch {
      return destroyed
        ? state
        : failed(timeout.signal.aborted ? "timeout" : "network error");
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", abort);
    }
  };

  const client: SyncClient = {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    revalidate() {
      if (problem || destroyed) return Promise.resolve(state);
      pending ??= run().finally(() => {
        pending = undefined;
      });
      return pending;
    },
    destroy() {
      destroyed = true;
      listeners.clear();
      controller.abort();
    },
  };
  if (!problem && options.revalidate !== false) {
    const idle =
      (globalThis as { requestIdleCallback?: (fn: () => void) => void })
        .requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1));
    idle(() => void client.revalidate());
  }
  return client;
}
