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

const DEFAULT_API = "https://cookiechimp.com";
const ID = /^[\w-]{1,64}$/;
const MAX_RESPONSE = 65536;

/**
 * One record in the platform batch format
 * (`POST /api/v1/mobile-sdk/sync/:account_hashid`, `consents[]`).
 * These are the only fields sent. No IP, user agent field, device id,
 * user id or page path is included; the browser adds its own User-Agent header.
 */
export interface PlatformConsent {
  /** `consentId:ts`, stable across retries. */
  client_id: string;
  /** The random consent id from the `cc_consent` cookie. */
  uuid: string;
  platform: "web";
  visitor_action: "consent";
  /** Page origin only, never the path or query. */
  url: string;
  gpc_preference: boolean;
  language_code?: string;
  consent_banner_hashid?: string;
  created_at: string;
  user_preferences: {
    acceptType: "all" | "necessary" | "custom";
    action: ConsentRecord["action"];
    acceptedCategories: string[];
    rejectedCategories: string[];
    acceptedServices: Record<string, string[]>;
    rejectedServices: Record<string, string[]>;
    regulation?: string;
  };
}

export interface ConsentLogOptions extends RecordQueueOptions {
  /** Platform account hashid. */
  projectId: string;
  /** Platform origin. Defaults to https://cookiechimp.com. */
  apiBase?: string;
  /** Banner hashid from the synced config (`state.dashboard.bannerId`). */
  bannerId?: string;
  /** Service id to category id, used to group services. */
  serviceCategories?: Readonly<Record<string, string>>;
}

/** Build the platform record for a consent decision. Exported for tests and docs. */
export function toPlatformConsent(
  consent: ConsentRecord,
  options: {
    url: string;
    bannerId?: string;
    language?: string;
    serviceCategories?: Readonly<Record<string, string>>;
  },
): PlatformConsent {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const [name, enabled] of Object.entries(consent.categories))
    (enabled ? accepted : rejected).push(name);
  const acceptedServices: Record<string, string[]> = {};
  const rejectedServices: Record<string, string[]> = {};
  for (const [id, enabled] of Object.entries(consent.services ?? {})) {
    const category =
      (options.serviceCategories &&
        Object.hasOwn(options.serviceCategories, id) &&
        options.serviceCategories[id]) ||
      "other";
    const target = enabled ? acceptedServices : rejectedServices;
    if (!Object.hasOwn(target, category)) target[category] = [];
    target[category]?.push(id);
  }
  const record: PlatformConsent = {
    client_id: `${consent.consentId}:${consent.ts}`,
    uuid: consent.consentId,
    platform: "web",
    visitor_action: "consent",
    url: options.url,
    gpc_preference: consent.gpc === true,
    created_at: consent.ts,
    user_preferences: {
      acceptType:
        consent.action === "accept_all"
          ? "all"
          : consent.action === "reject_all"
            ? "necessary"
            : "custom",
      action: consent.action,
      acceptedCategories: accepted,
      rejectedCategories: rejected,
      acceptedServices,
      rejectedServices,
    },
  };
  const language = short(options.language, 16);
  const banner = short(options.bannerId, 64);
  if (language) record.language_code = language;
  if (banner) record.consent_banner_hashid = banner;
  if (consent.regulation)
    record.user_preferences.regulation = consent.regulation;
  return record;
}

/** Parse an untrusted sync response into client ids that should leave the queue. */
function settled(body: string): Set<string> | undefined {
  if (body.length > MAX_RESPONSE) return;
  try {
    const value = JSON.parse(body) as {
      synced?: unknown;
      failed?: unknown;
    } | null;
    if (
      typeof value !== "object" ||
      value === null ||
      (!Array.isArray(value.synced) && !Array.isArray(value.failed))
    )
      return;
    const done = new Set<string>();
    const ids = (
      list: unknown,
      keep: (item: Record<string, unknown>) => boolean,
    ) => {
      if (Array.isArray(list))
        for (const item of list)
          if (
            typeof item === "object" &&
            item !== null &&
            typeof item.client_id === "string" &&
            keep(item)
          )
            done.add(item.client_id);
    };
    ids(value.synced, () => true);
    // Validation failures will never succeed; a batch cap overflow should retry.
    ids(
      value.failed,
      (item) =>
        !(
          Array.isArray(item.errors) &&
          item.errors.includes("Batch limit exceeded")
        ),
    );
    return Array.isArray(value.synced) || Array.isArray(value.failed)
      ? done
      : undefined;
  } catch {}
}

/** Queue consent records and deliver them to the platform with retries. */
export function createConsentLog(options: ConsentLogOptions): ConsentLog {
  const base = secureUrl(options.apiBase ?? DEFAULT_API);
  const problem = !ID.test(options.projectId)
    ? "invalid projectId"
    : !base || base.search
      ? "apiBase must be https"
      : undefined;
  return createRecordQueue<PlatformConsent>({
    ...options,
    label: "consent log",
    problem,
    endpoint: `${base?.href.replace(/\/$/, "")}/api/v1/mobile-sdk/sync/${options.projectId}`,
    key: `cc_consent_queue:${options.projectId}`,
    build: (consent, language) =>
      toPlatformConsent(consent, {
        url: origin(),
        language,
        bannerId: options.bannerId,
        serviceCategories: options.serviceCategories,
      }),
    id: (record) => record.client_id,
    ts: (record) => record.created_at,
    body: (consents) => ({ consents }),
    settled,
  });
}
