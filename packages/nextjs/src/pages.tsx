"use client";

import type { IncomingHttpHeaders } from "node:http";
import {
  CONSENT_COOKIE_NAME,
  type ConsentConfig,
  type ConsentState,
  readConsentCookie,
} from "@cookiechimp/core";
import { resolveLanguage } from "@cookiechimp/core/language";
import {
  type Region,
  type RegionHeaderOptions,
  regulationFor,
  resolveRegion,
} from "@cookiechimp/core/regions";
import type { ComponentType, ReactNode } from "react";
import { ClientProvider, type ConsentEndpoint, type ConsentGpp } from "./index";

export interface PagesConsentOptions {
  config: ConsentConfig;
  provider?: RegionHeaderOptions["provider"];
  /** Trust the region header set by CookieChimp middleware. */
  trustForwardedRegion?: boolean;
  header?: string;
  region?: Region | null;
  languages?: { available: readonly string[]; fallback: string };
}

export interface PagesConsentProps {
  consent: ConsentState | null;
  region: Region | null;
  language?: string;
}

type RequestLike = { headers: IncomingHttpHeaders | Headers };

function invalid(message: string): void {
  const text = `Invalid CookieChimp Next.js Pages options: ${message}`;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new TypeError(text);
  console.warn(text);
}

function getHeader(headers: IncomingHttpHeaders | Headers, name: string) {
  if (headers instanceof Headers) return headers.get(name);
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function validate(options: PagesConsentOptions) {
  if (!options.config) invalid("config is required");
  if (
    options.trustForwardedRegion !== undefined &&
    typeof options.trustForwardedRegion !== "boolean"
  )
    invalid("trustForwardedRegion must be a boolean");
  if (options.provider === "custom" && !options.header)
    invalid("header is required for the custom provider");
}

/** Resolve the serializable consent props for a Pages Router request. */
export function getPagesConsentProps(
  req: RequestLike,
  options: PagesConsentOptions,
): PagesConsentProps {
  validate(options);
  const cookieName = options.config.cookie?.name ?? CONSENT_COOKIE_NAME;
  const cookie = getHeader(req.headers, "cookie") ?? "";
  const consent = readConsentCookie(cookie, cookieName);
  const forwardedMatch = options.trustForwardedRegion
    ? /^([A-Z]{2})(?:-([A-Z0-9]{1,3}))?$/.exec(
        getHeader(req.headers, "x-cc-region")?.trim().toUpperCase() ?? "",
      )
    : null;
  const region =
    options.region !== undefined
      ? options.region
      : ((forwardedMatch
          ? {
              country: forwardedMatch[1] as string,
              ...(forwardedMatch[2] ? { region: forwardedMatch[2] } : {}),
            }
          : null) ??
        (options.provider
          ? resolveRegion(req.headers, {
              provider: options.provider,
              header: options.header,
            })
          : null));
  const language = options.languages
    ? resolveLanguage(
        getHeader(req.headers, "accept-language"),
        options.languages.available,
        options.languages.fallback,
      )
    : undefined;
  return { consent, region, ...(language ? { language } : {}) };
}

export interface PagesConsentProviderProps extends PagesConsentProps {
  config: ConsentConfig;
  /** Self-hosted consent log endpoint; see `ConsentProvider`. */
  endpoint?: ConsentEndpoint;
  /** Opt-in IAB GPP US sections; see `ConsentProvider`. */
  gpp?: ConsentGpp;
  children: ReactNode;
}

/** Client boundary suitable for both a single page and pages/_app. */
export function PagesConsentProvider({
  config,
  consent,
  region,
  language,
  endpoint,
  gpp,
  children,
}: PagesConsentProviderProps) {
  return (
    <ClientProvider
      config={{
        ...config,
        region,
        regulation: regulationFor(region),
        ...(language ? { language } : {}),
      }}
      initialState={consent}
      language={language}
      endpoint={endpoint}
      gpp={gpp}
    >
      {children}
    </ClientProvider>
  );
}

type ServerPropsResult<P> =
  | { props: P | Promise<P> }
  | { redirect: unknown }
  | { notFound: true };
type ServerProps<P> = (context: {
  req: RequestLike;
}) => ServerPropsResult<P> | Promise<ServerPropsResult<P>>;

/** Add `cookiechimp` to an existing getServerSideProps result. */
export function withConsent<
  P extends Record<string, unknown> = Record<string, never>,
>(
  options: PagesConsentOptions,
  handler?: ServerProps<P>,
): ServerProps<P & { cookiechimp: PagesConsentProps }> {
  validate(options);
  return async (context) => {
    const result = handler ? await handler(context) : { props: {} as P };
    if (!("props" in result))
      return result as ServerPropsResult<
        P & { cookiechimp: PagesConsentProps }
      >;
    return {
      props: {
        ...(await result.props),
        cookiechimp: getPagesConsentProps(context.req, options),
      },
    };
  };
}

/** Wrap a page component when a local provider is preferable to pages/_app. */
export function withConsentPage<P extends { cookiechimp: PagesConsentProps }>(
  Page: ComponentType<P>,
  options: PagesConsentOptions,
) {
  validate(options);
  return function ConsentPage(props: P) {
    return (
      <PagesConsentProvider config={options.config} {...props.cookiechimp}>
        <Page {...props} />
      </PagesConsentProvider>
    );
  };
}
