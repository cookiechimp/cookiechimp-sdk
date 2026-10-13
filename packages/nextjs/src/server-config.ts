import type { ConfigInput, NormalizedConfig } from "@cookiechimp/core";
import type { Region } from "@cookiechimp/core/regions";
import {
  adaptPlatformConfig,
  type DashboardConfig,
  mergeConfig,
  safeJson,
} from "@cookiechimp/core/sync";
import type { Messages } from "@cookiechimp/react";
import { dashboardMessages } from "./messages";

export { dashboardMessages } from "./messages";

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
  /** Dashboard cookie name and lifetime (seconds), when valid. */
  cookie?: { name?: string; maxAge?: number };
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

export const regionKey = (region: ServerConfigOptions["region"]) =>
  !region
    ? undefined
    : typeof region === "string"
      ? region
      : region.region
        ? `${region.country}-${region.region}`
        : region.country;

const COOKIE_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/;
const days = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 730
    ? (value as number)
    : undefined;
const field = (value: unknown, key: string): unknown =>
  value && typeof value === "object" && Object.hasOwn(value, key)
    ? (value as Record<string, unknown>)[key]
    : undefined;

/**
 * Dashboard cookie settings: `cookie_settings.name`, and the selected banner's
 * `expires_days` before `cookie_settings.expires_days`. Invalid values are ignored.
 */
export function dashboardCookie(
  dashboard?: DashboardConfig,
): ServerConfig["cookie"] {
  if (!dashboard) return;
  const name = field(dashboard.cookie, "name");
  const expiry =
    days(field(dashboard.banner, "expires_days")) ??
    days(field(dashboard.cookie, "expires_days"));
  const cookie: NonNullable<ServerConfig["cookie"]> = {};
  if (typeof name === "string" && COOKIE_NAME.test(name)) cookie.name = name;
  if (expiry) cookie.maxAge = expiry * 86400;
  return cookie.name || cookie.maxAge ? cookie : undefined;
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
      ...(dashboardCookie(dashboard)
        ? { cookie: dashboardCookie(dashboard) }
        : {}),
      source: "dashboard",
    };
  } catch (error) {
    // Still render the code config, but never hide a bug behind "network error".
    if (isDev()) console.warn("CookieChimp server config:", error);
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
