import "server-only";

import {
  CONSENT_COOKIE_NAME,
  type ConfigInput,
  type ConsentConfig,
  type ConsentState,
  readConsentCookie,
} from "@cookiechimp/core";
import { consentModeInlineScript } from "@cookiechimp/core/consent-mode";
import { gppStubScript } from "@cookiechimp/core/gpp-stub";
import { resolveLanguage } from "@cookiechimp/core/language";
import {
  type Region,
  type RegionHeaderOptions,
  type Regulation,
  readGpc,
  regulationFor,
  resolveRegion,
} from "@cookiechimp/core/regions";
import type { Messages } from "@cookiechimp/react";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { criticalCss } from "./critical-css.generated";
import { ClientProvider, type ConsentEndpoint, type ConsentGpp } from "./index";
import { getServerConfig, regionKey } from "./server-config";

export {
  dashboardCookie,
  dashboardMessages,
  getServerConfig,
  type ServerConfig,
  type ServerConfigOptions,
} from "./server-config";

export interface LanguageOptions {
  available: readonly string[];
  fallback: string;
}

export interface GetServerConsentOptions {
  cookieName?: string;
  provider?: RegionHeaderOptions["provider"];
  /** Trust the region header set by CookieChimp middleware. */
  trustForwardedRegion?: boolean;
  /** Already-resolved request region. No location lookup is performed. */
  region?: Region | null;
  languages?: LanguageOptions | readonly string[];
}

function forwardedRegion(requestHeaders: Headers): Region | null {
  const match = /^([A-Z]{2})(?:-([A-Z0-9]{1,3}))?$/.exec(
    requestHeaders.get("x-cc-region")?.trim().toUpperCase() ?? "",
  );
  return match
    ? {
        country: match[1] as string,
        ...(match[2] ? { region: match[2] } : {}),
      }
    : null;
}

export type ServerConsentState = ConsentState & {
  region: Region | null;
  regulation: Regulation;
  language?: string;
};

function languageOptions(
  languages: GetServerConsentOptions["languages"],
): LanguageOptions | undefined {
  if (!languages) return;
  return Array.isArray(languages)
    ? { available: languages, fallback: languages[0] ?? "en" }
    : (languages as LanguageOptions);
}

function invalid(message: string): void {
  const text = `Invalid CookieChimp Next.js options: ${message}`;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(text);
  console.warn(text);
}

function validate(options: GetServerConsentOptions): void {
  if (
    options.trustForwardedRegion !== undefined &&
    typeof options.trustForwardedRegion !== "boolean"
  )
    invalid("trustForwardedRegion must be a boolean");
  if (
    options.cookieName !== undefined &&
    !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(options.cookieName)
  )
    invalid("cookieName must be a valid cookie name");
  if (
    options.provider !== undefined &&
    !["vercel", "cloudflare", "cloudfront"].includes(options.provider)
  )
    invalid("provider must be vercel, cloudflare, or cloudfront");
  const languages = languageOptions(options.languages);
  if (
    languages &&
    (!Array.isArray(languages.available) ||
      languages.available.length === 0 ||
      !languages.available.includes(languages.fallback))
  )
    invalid(
      "languages must include a non-empty available list containing fallback",
    );
}

/** Read and validate the current App Router request's consent cookie. */
export function getServerConsent(
  options: GetServerConsentOptions &
    (
      | { provider: NonNullable<GetServerConsentOptions["provider"]> }
      | { region: Region | null }
      | { trustForwardedRegion: boolean }
      | {
          languages: NonNullable<GetServerConsentOptions["languages"]>;
        }
    ),
): Promise<ServerConsentState | null>;
export function getServerConsent(
  options?: GetServerConsentOptions,
): Promise<ConsentState | null>;
export async function getServerConsent(
  options: GetServerConsentOptions = {},
): Promise<ConsentState | ServerConsentState | null> {
  validate(options);
  const name = options.cookieName ?? CONSENT_COOKIE_NAME;
  const value = (await cookies()).get(name)?.value;
  const consent = value
    ? readConsentCookie(`${name}=${encodeURIComponent(value)}`, name)
    : null;
  if (
    !consent ||
    (!options.provider &&
      options.region === undefined &&
      !options.trustForwardedRegion &&
      !options.languages)
  )
    return consent;
  const requestHeaders = await headers();
  const region =
    options.region !== undefined
      ? options.region
      : ((options.trustForwardedRegion
          ? forwardedRegion(requestHeaders)
          : null) ??
        (options.provider
          ? resolveRegion(requestHeaders, { provider: options.provider })
          : null));
  const languages = languageOptions(options.languages);
  const language = languages
    ? resolveLanguage(
        requestHeaders.get("accept-language"),
        languages.available,
        languages.fallback,
      )
    : undefined;
  return {
    ...consent,
    region,
    regulation: regulationFor(region),
    ...(language ? { language } : {}),
  };
}

export type TranslationLoader = (
  locale: string,
) => Messages | Promise<Messages>;

export interface CookieChimpProviderProps
  extends Omit<GetServerConsentOptions, "cookieName"> {
  config: ConsentConfig;
  translations?: Messages | TranslationLoader;
  /** Self-hosted consent log endpoint; must be serialisable (no functions). */
  endpoint?: ConsentEndpoint;
  /**
   * Opt-in IAB GPP US sections (serialisable). The GPP module loads lazily in
   * the browser; render `<GppStub />` in the head before vendor tags.
   */
  gpp?: ConsentGpp;
  /**
   * Connected mode: fetch this account's dashboard config on the server
   * (`revalidate` seconds, default 300) so SSR markup already has it.
   * `config` acts as the defaults under the dashboard values.
   */
  projectId?: string;
  /** Platform origin. Defaults to https://cookiechimp.com. */
  apiBase?: string;
  /** Code config that wins over the dashboard. */
  override?: ConfigInput;
  revalidate?: number;
  /** Server-only transport for the config request (tests, proxies). Never sent to the client. */
  fetch?: typeof fetch;
  /**
   * Revalidate the dashboard config in the browser after hydration, so copy
   * newer than the server cache shows without a reload. Defaults to true;
   * off when a custom server `fetch` is given (the browser cannot use it).
   */
  revalidateClient?: boolean;
  children: ReactNode;
}

/** App Router server boundary that seeds the client runtime from request data. */
export async function CookieChimpProvider({
  config,
  provider,
  trustForwardedRegion,
  region: suppliedRegion,
  languages,
  translations,
  endpoint,
  gpp,
  projectId,
  apiBase,
  override,
  revalidate,
  fetch,
  revalidateClient,
  children,
}: CookieChimpProviderProps) {
  const resolvedCookieName = config.cookie?.name ?? CONSENT_COOKIE_NAME;
  validate({
    cookieName: resolvedCookieName,
    provider,
    trustForwardedRegion,
    languages,
  });
  const languageConfig = languageOptions(languages);
  const requestHeaders = await headers();
  const region =
    suppliedRegion !== undefined
      ? suppliedRegion
      : ((trustForwardedRegion ? forwardedRegion(requestHeaders) : null) ??
        (provider ? resolveRegion(requestHeaders, { provider }) : null));
  const regulation = regulationFor(region);
  const language = languageConfig
    ? resolveLanguage(
        requestHeaders.get("accept-language"),
        languageConfig.available,
        languageConfig.fallback,
      )
    : config.language;
  const messages =
    typeof translations === "function" && language
      ? await translations(language)
      : typeof translations === "function"
        ? undefined
        : translations;
  const server = projectId
    ? await getServerConfig({
        projectId,
        apiBase,
        locale: language,
        region,
        defaults: config,
        override,
        revalidate,
        fetch,
      })
    : undefined;
  // The dashboard cookie settings win over the code defaults, and the
  // visitor's existing consent is read under the resulting name.
  const cookieName = server?.cookie?.name ?? resolvedCookieName;
  const maxAge = server?.cookie?.maxAge ?? config.cookie?.maxAge;
  const initialState = await getServerConsent({ cookieName });
  return (
    <ClientProvider
      config={{
        ...config,
        ...(server
          ? {
              categories: server.config.categories,
              services: server.config.services,
            }
          : {}),
        cookie: {
          ...config.cookie,
          name: cookieName,
          ...(maxAge ? { maxAge } : {}),
        },
        region,
        regulation,
        gpc: readGpc(requestHeaders),
        ...(language ? { language } : {}),
      }}
      initialState={initialState}
      language={language}
      messages={server ? { ...messages, ...server.messages } : messages}
      endpoint={endpoint}
      gpp={gpp}
      sync={
        projectId && server && !fetch && revalidateClient !== false
          ? {
              projectId,
              ...(apiBase ? { apiBase } : {}),
              ...(language ? { locale: language } : {}),
              ...(regionKey(region) ? { region: regionKey(region) } : {}),
              ...(server.dashboard ? { etag: server.dashboard.etag } : {}),
            }
          : undefined
      }
    >
      {children}
    </ClientProvider>
  );
}

/** Inline generated banner CSS before an external stylesheet becomes available. */
export function CookieChimpStyles({ nonce }: { nonce?: string }) {
  return (
    <style
      nonce={nonce}
      data-cookiechimp-critical=""
      // The build-generated value contains CSS only and receives no user input.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: generated from package-owned CSS at build time.
      dangerouslySetInnerHTML={{ __html: criticalCss }}
    />
  );
}

/** Install Consent Mode defaults at the start of the document head. */
export function GoogleConsentMode({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      data-cookiechimp-consent-mode=""
      // biome-ignore lint/security/noDangerouslySetInnerHtml: core safely JSON-escapes the static Consent Mode payload.
      dangerouslySetInnerHTML={{ __html: consentModeInlineScript() }}
    />
  );
}

/**
 * Inline the IAB `__gpp` stub (under 1 KB) at the start of the document head,
 * before any vendor tag, when the provider has `gpp` set.
 */
export function GppStub({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      data-cookiechimp-gpp=""
      // biome-ignore lint/security/noDangerouslySetInnerHtml: package-owned static stub source with no user input.
      dangerouslySetInnerHTML={{ __html: gppStubScript }}
    />
  );
}

export { criticalCss };
