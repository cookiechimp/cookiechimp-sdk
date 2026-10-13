import type { ConsentRecord } from "./index";
import {
  type ConsentLog,
  createRecordQueue,
  logConsent,
  origin,
  type RecordQueueOptions,
  secureUrl,
  short,
} from "./internal/record-queue";

export { type ConsentLog, logConsent };

/**
 * One consent record as POSTed to a self-hosted endpoint, inside
 * `{"schemaVersion": 1, "records": [...]}`. These are the only fields sent:
 * no IP, user agent field, device id, user id, cookies or page path.
 */
export interface EndpointRecord {
  /** `consentId:ts`, unique per decision and stable across retries. Use it to deduplicate. */
  id: string;
  /** The random consent id from the `cc_consent` cookie. */
  consentId: string;
  /** Decision time, ISO 8601. */
  ts: string;
  action: ConsentRecord["action"];
  categories: Record<string, boolean>;
  services?: Record<string, boolean>;
  regulation?: string;
  gpc: boolean;
  language?: string;
  /** Page origin only, never the path or query. */
  url: string;
}

export interface EndpointLogOptions extends RecordQueueOptions {
  /**
   * Your endpoint: an https URL, or a same-origin path such as `/api/consent`
   * (sent with the page's own protocol). An absolute http URL is accepted for
   * localhost in development only.
   */
  endpoint: string;
}

const MAX_RESPONSE = 65536;

/** Build the self-hosted record for a consent decision. */
export function toEndpointRecord(
  consent: ConsentRecord,
  options: { url: string; language?: string },
): EndpointRecord {
  const record: EndpointRecord = {
    id: `${consent.consentId}:${consent.ts}`,
    consentId: consent.consentId,
    ts: consent.ts,
    action: consent.action,
    categories: { ...consent.categories },
    gpc: consent.gpc === true,
    url: options.url,
  };
  if (consent.services) record.services = { ...consent.services };
  if (consent.regulation) record.regulation = consent.regulation;
  const language = short(options.language, 16);
  if (language) record.language = language;
  return record;
}

// An optional `{"accepted": ["id", ...]}` body confirms only those ids;
// any other 2xx body means the whole batch was stored.
function settled(body: string): Set<string> | undefined {
  if (body.length > MAX_RESPONSE) return;
  try {
    const value = JSON.parse(body) as { accepted?: unknown } | null;
    if (!Array.isArray(value?.accepted)) return;
    return new Set(
      value.accepted.filter((item): item is string => typeof item === "string"),
    );
  } catch {}
}

function resolve(endpoint: unknown): URL | undefined {
  if (typeof endpoint !== "string" || /^\/[/\\]/.test(endpoint)) return;
  if (endpoint.startsWith("/")) {
    // A same-origin path inherits the page's own protocol, so it exposes
    // nothing the page does not already expose.
    const base = origin();
    try {
      const url = new URL(endpoint, base);
      if (url.origin === base && !url.hash) return url;
    } catch {}
    return;
  }
  return /^https?:\/\//i.test(endpoint) ? secureUrl(endpoint) : undefined;
}

/**
 * Queue consent records and POST them to your own endpoint (local mode,
 * no CookieChimp account) with the same retries, persistence and
 * fail-closed behaviour as `@cookiechimp/core/consent-log`.
 */
export function createEndpointLog(options: EndpointLogOptions): ConsentLog {
  const url = resolve(options.endpoint);
  return createRecordQueue<EndpointRecord>({
    ...options,
    label: "endpoint log",
    problem: url
      ? undefined
      : "endpoint must be an https URL or a same-origin path",
    endpoint: url?.href ?? "",
    key: `cc_consent_queue:@${url?.href ?? ""}`,
    build: (consent, language) =>
      toEndpointRecord(consent, { url: origin(), language }),
    id: (record) => record.id,
    ts: (record) => record.ts,
    body: (records) => ({ schemaVersion: 1, records }),
    settled,
  });
}
