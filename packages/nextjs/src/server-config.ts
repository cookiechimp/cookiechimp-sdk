import type { ConfigInput, NormalizedConfig } from "@cookiechimp/core";
import type { Region } from "@cookiechimp/core/regions";
import {
  adaptPlatformConfig,
  type DashboardConfig,
  mergeConfig,
  safeJson,
} from "@cookiechimp/core/sync";
import type { Messages } from "@cookiechimp/react";

const DEFAULT_API = "https://cookiechimp.com";
const MAX_BYTES = 524288;
const ID = /^[\w-]{1,64}$/;

const isDev = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export interface ServerConfigOptions {
  /** Platform account hashid (public). */
  projectId: string;
  /** Platform origin. Defaults to https://cookiechimp.com. */
  apiBase?: string;
  /** Selects the banner language, for example `fr-CA`. */
  locale?: string;
  /** Selects the banner from `country_banner_map`. */
  region?: Region | string | null;
  /** Code config used under the dashboard values. */
  defaults?: ConfigInput;
  /** Code config that wins over the dashboard. */
  override?: ConfigInput;
  /** Next.js data cache lifetime in seconds. Defaults to 300. */
  revalidate?: number;
  /** Give up after this many milliseconds and render the code config. Defaults to 3000. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface ServerConfig {
  /** defaults < dashboard < override, ready for `ConsentConfig`. */
  config: NormalizedConfig;
  dashboard?: DashboardConfig;
  /** Plain-text dashboard banner copy as translation messages. */
  messages: Messages;
  source: "dashboard" | "local";
  error?: string;
}

function apiUrl(base: string): string | undefined {
  try {
    const url = new URL(base);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    if (url.username || url.password || url.search || url.hash) return;
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" && local && isDev())
    )
      return url.href.replace(/\/+$/, "");
  } catch {}
}

const regionKey = (region: ServerConfigOptions["region"]) =>
  !region
    ? undefined
    : typeof region === "string"
      ? region
      : region.region
        ? `${region.country}-${region.region}`
        : region.country;

// Dashboard fields that may hold HTML are only used when they are plain text,
// because messages render as text.
const plain = (value: unknown) =>
  typeof value === "string" &&
  value.trim() &&
  value.length <= 500 &&
  !/[<>]/.test(value)
    ? value
    : undefined;

const MESSAGE_FIELDS: [string, string, string][] = [
  ["consent_modal", "title", "banner.title"],
  ["consent_modal", "description", "banner.description"],
  ["consent_modal", "accept_btn", "banner.acceptAll"],
  ["consent_modal", "reject_btn", "banner.rejectAll"],
  ["consent_modal", "preferences_btn", "banner.customize"],
  ["consent_modal", "close_btn", "banner.close"],
  ["preferences_modal", "title", "preferences.title"],
  ["preferences_modal", "description", "preferences.description"],
  ["preferences_modal", "save_btn", "banner.save"],
];

/** Map the selected banner's plain-text dashboard copy to translation messages. */
export function dashboardMessages(dashboard?: DashboardConfig): Messages {
  const messages: Record<string, string> = {};
  for (const [section, field, key] of MESSAGE_FIELDS) {
    const group = dashboard?.copy[section];
    const value =
      group && typeof group === "object" && Object.hasOwn(group, field)
        ? plain((group as Record<string, unknown>)[field])
        : undefined;
    if (value) messages[key] = value;
  }
  return messages as Messages;
}

/**
 * Fetch the dashboard config on the server (Next.js data cache,
 * `revalidate: 300` by default) so SSR markup already has it. Never throws in
 * production: any failure renders the code config.
 */
export async function getServerConfig(
  options: ServerConfigOptions,
): Promise<ServerConfig> {
  const local = (error?: string): ServerConfig => ({
    config: mergeConfig(options.defaults ?? {}, undefined, options.override),
    messages: {} as Messages,
    source: "local",
    ...(error ? { error } : {}),
  });
  const base = apiUrl(options.apiBase ?? DEFAULT_API);
  const problem = !ID.test(options.projectId ?? "")
    ? "invalid projectId"
    : !base
      ? "apiBase must be https"
      : undefined;
  if (problem) {
    if (isDev()) throw new TypeError(`CookieChimp server config: ${problem}`);
    return local(problem);
  }
  const doFetch = options.fetch ?? globalThis.fetch;
  try {
    const response = await doFetch(
      `${base}/api/v1/mobile-sdk/offline/${options.projectId}`,
      {
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
        next: { revalidate: options.revalidate ?? 300 },
      } as RequestInit,
    );
    if (!response.ok) return local(`HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_BYTES) return local("config too large");
    const body = await response.text();
    if (body.length > MAX_BYTES) return local("config too large");
    const dashboard = adaptPlatformConfig(safeJson(body), {
      projectId: options.projectId,
      locale: options.locale,
      region: regionKey(options.region),
    });
    if (!dashboard) return local("invalid config");
    return {
      config: mergeConfig(
        options.defaults ?? {},
        { categories: dashboard.categories, services: dashboard.services },
        options.override,
      ),
      dashboard,
      messages: dashboardMessages(dashboard),
      source: "dashboard",
    };
  } catch (error) {
    const name = (error as Error)?.name;
    return local(
      name === "TimeoutError"
        ? "timeout"
        : name === "SyntaxError"
          ? "invalid config"
          : "network error",
    );
  }
}
