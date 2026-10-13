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

const DEFAULT_API = "https://api.cookiechimp.com/sdk/v1";
const MAX_BYTES = 524288;
const ID = /^[\w-]{1,64}$/;
const KEY = /^cc_pk_[\w-]{8,128}$/;

export interface DashboardConfig {
  schemaVersion: number;
  configVersion: string;
  etag?: string;
  categories: CategoryConfig[];
  services: ServiceConfig[];
  copy: Record<string, unknown>;
  translations: Record<string, unknown>;
  regions: Record<string, unknown>;
  theme: Record<string, unknown>;
}

export type ConfigSource = "local" | "cache" | "dashboard";

export interface SyncState {
  config: NormalizedConfig;
  dashboard?: DashboardConfig;
  source: ConfigSource;
  status: "idle" | "loading" | "ready" | "error" | "disabled";
  error?: string;
  /** True when dashboard categories changed since the cached version. */
  categoriesChanged: boolean;
}

export interface SyncOptions {
  projectId: string;
  /** Publishable key (`cc_pk_...`). Secret keys are refused. */
  publishableKey: string;
  defaults?: ConfigInput;
  override?: ConfigInput;
  locale?: string;
  region?: string;
  apiBase?: string;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  fetch?: typeof fetch;
  /** Abort a revalidation after this many milliseconds. Defaults to 5000. */
  timeoutMs?: number;
  /** Revalidate automatically in idle time after creation. Defaults to true. */
  revalidate?: boolean;
  /** Report category changes for re-prompting. Defaults to true. */
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

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 512) =>
  typeof value === "string" && value.length <= max ? value : undefined;
const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => !!text(item, 2048))
    : undefined;
const pick = <T extends object>(entries: [string, unknown][]) =>
  Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as T;
const flag = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;
const list = <T>(value: unknown, map: (item: Record<string, unknown>) => T) =>
  (Array.isArray(value) ? value : [])
    .filter((item) => record(item) && text(item.id, 64))
    .map(map);

/** Validate an untrusted dashboard payload, keeping only known fields. */
export function parseDashboardConfig(
  value: unknown,
): DashboardConfig | undefined {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !text(value.configVersion, 128)
  )
    return;
  const object = (item: unknown) => (record(item) ? item : {});
  return {
    schemaVersion: 1,
    configVersion: value.configVersion as string,
    etag: text(value.etag),
    categories: list(value.categories, (item) =>
      pick<CategoryConfig>([
        ["id", item.id],
        ["required", flag(item.required)],
        ["default", flag(item.default)],
        ["label", text(item.label)],
        ["description", text(item.description, 4096)],
      ]),
    ),
    services: list(value.services, (item) =>
      pick<ServiceConfig>([
        ["id", item.id],
        ["category", text(item.category, 64)],
        ["name", text(item.name)],
        ["scripts", strings(item.scripts)],
        ["cookies", strings(item.cookies)],
        ["domains", strings(item.domains)],
        ["default", flag(item.default)],
      ]),
    ).filter((service) => service.category),
    copy: object(value.copy),
    translations: object(value.translations),
    regions: object(value.regions),
    theme: object(value.theme),
  };
}

const layer = (dashboard?: DashboardConfig): ConfigInput | undefined =>
  dashboard && {
    categories: dashboard.categories,
    services: dashboard.services,
  };

const safeJson = (body: string): unknown =>
  JSON.parse(body, (key, value) =>
    key === "__proto__" || key === "constructor" || key === "prototype"
      ? undefined
      : value,
  );

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
  const problem = !ID.test(options.projectId)
    ? "invalid projectId"
    : options.publishableKey?.startsWith("cc_sk_")
      ? "secret keys must never be used in the browser"
      : !KEY.test(options.publishableKey ?? "")
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
      const parsed = raw ? parseDashboardConfig(safeJson(raw)) : undefined;
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
  const writeCache = (dashboard: DashboardConfig) => {
    try {
      const previous = storage?.getItem(pointer);
      storage?.setItem(
        `${pointer}:${dashboard.configVersion}`,
        JSON.stringify(dashboard),
      );
      storage?.setItem(pointer, dashboard.configVersion);
      if (previous && previous !== dashboard.configVersion)
        storage?.removeItem(`${pointer}:${previous}`);
    } catch {}
  };
  const failed = (error: string) => emit({ ...state, status: "error", error });

  const run = async (): Promise<SyncState> => {
    const doFetch = options.fetch ?? globalThis.fetch;
    if (!doFetch) return failed("fetch unavailable");
    const current = state.dashboard;
    emit({ ...state, status: "loading" });
    const query = new URLSearchParams();
    if (options.locale) query.set("locale", options.locale);
    if (options.region) query.set("region", options.region);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.publishableKey}`,
    };
    if (current?.etag) headers["If-None-Match"] = current.etag;
    const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? 5000);
    const timeout = new AbortController();
    const abort = () => timeout.abort();
    controller.signal.addEventListener("abort", abort);
    try {
      const response = await doFetch(
        `${base}/projects/${options.projectId}/config${query.size ? `?${query}` : ""}`,
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
      const parsed = parseDashboardConfig(safeJson(body));
      if (!parsed) return failed("invalid config");
      parsed.etag ??= text(response.headers.get("etag"));
      const changed =
        options.reprompt !== false &&
        !!current &&
        categoriesHash(
          mergeConfig(defaults, layer(current), options.override),
        ) !==
          categoriesHash(
            mergeConfig(defaults, layer(parsed), options.override),
          );
      const next = build(parsed, "dashboard", "ready", changed);
      if (!next) return failed("invalid config");
      writeCache(parsed);
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
