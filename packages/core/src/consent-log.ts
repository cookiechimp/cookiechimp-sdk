import type { ConsentRecord } from "./index";

const DEFAULT_API = "https://cookiechimp.com";
const ID = /^[\w-]{1,64}$/;
const DAY = 86400000;
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

interface Queued {
  record: PlatformConsent;
  attempts: number;
  next: number;
}

export interface ConsentLogOptions {
  /** Platform account hashid. */
  projectId: string;
  /** Platform origin. Defaults to https://cookiechimp.com. */
  apiBase?: string;
  /** Banner hashid from the synced config (`state.dashboard.bannerId`). */
  bannerId?: string;
  /** Service id to category id, used to group services. */
  serviceCategories?: Readonly<Record<string, string>>;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  fetch?: typeof fetch;
  sendBeacon?: (url: string, data: Blob) => boolean;
  /** Queue cap; the oldest records are dropped first. Defaults to 50. */
  maxQueue?: number;
  /** Records older than this are dropped. Defaults to 30 days. */
  maxAgeMs?: number;
  /** First retry delay. Defaults to 2000 ms, doubling up to `maxDelayMs`. */
  baseDelayMs?: number;
  /** Defaults to 5 minutes. */
  maxDelayMs?: number;
  /** Abort a POST after this many milliseconds. Defaults to 10000. */
  timeoutMs?: number;
  now?: () => number;
  random?: () => number;
}

export interface ConsentLog {
  /** Queue a decision. Synchronous, never throws, never blocks. */
  record(consent: ConsentRecord, language?: string): void;
  /** Send due records now. Resolves with the number still queued. */
  flush(): Promise<number>;
  /** Number of queued records. */
  pending(): number;
  destroy(): void;
}

const isDev = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

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

const short = (value: unknown, max: number) =>
  typeof value === "string" && value.length <= max ? value : undefined;

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

const valid = (item: unknown): item is Queued => {
  const value = item as Queued | null;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.attempts === "number" &&
    typeof value.next === "number" &&
    typeof value.record?.client_id === "string" &&
    typeof value.record.created_at === "string"
  );
};

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
  const base = apiUrl(options.apiBase ?? DEFAULT_API);
  const problem = !ID.test(options.projectId)
    ? "invalid projectId"
    : !base
      ? "apiBase must be https"
      : undefined;
  if (problem && isDev())
    throw new TypeError(`CookieChimp consent log: ${problem}`);
  const endpoint = `${base}/api/v1/mobile-sdk/sync/${options.projectId}`;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const maxQueue = options.maxQueue ?? 50;
  const maxAge = options.maxAgeMs ?? 30 * DAY;
  const key = `cc_consent_queue:${options.projectId}`;
  let storage: ConsentLogOptions["storage"];
  try {
    storage =
      options.storage === undefined ? globalThis.localStorage : options.storage;
  } catch {}
  const win = typeof window === "undefined" ? undefined : window;
  let queue: Queued[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sending: Promise<number> | undefined;
  let destroyed = false;
  const seen = new Set<string>();

  const prune = () => {
    const cutoff = now() - maxAge;
    queue = queue
      .filter((item) => Date.parse(item.record.created_at) >= cutoff)
      .slice(-maxQueue);
  };
  const save = () => {
    try {
      if (queue.length) storage?.setItem(key, JSON.stringify(queue));
      else storage?.removeItem(key);
    } catch {}
  };
  try {
    const raw = storage?.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) queue = parsed.filter(valid);
  } catch {}
  prune();
  for (const item of queue) seen.add(item.record.client_id);

  const schedule = () => {
    if (destroyed || problem || !queue.length) return;
    clearTimeout(timer);
    const next = Math.min(...queue.map((item) => item.next));
    timer = setTimeout(() => void log.flush(), Math.max(0, next - now()));
  };
  const backoff = (item: Queued) => {
    item.attempts += 1;
    const delay = Math.min(
      options.maxDelayMs ?? 300000,
      (options.baseDelayMs ?? 2000) * 2 ** (item.attempts - 1),
    );
    item.next = Math.ceil(now() + delay * (0.5 + random() / 2));
  };

  const send = async (): Promise<number> => {
    prune();
    const due = queue.filter((item) => item.next <= now());
    const doFetch = options.fetch ?? globalThis.fetch;
    if (!due.length || !doFetch) {
      // A timer can fire a little early; re-arm it so the retry is never lost.
      schedule();
      return queue.length;
    }
    const controller = new AbortController();
    const abort = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 10000,
    );
    let done: Set<string> | undefined;
    try {
      const response = await doFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consents: due.map((item) => item.record) }),
        credentials: "omit",
        keepalive: true,
        redirect: "error",
        signal: controller.signal,
      });
      if (response.ok) {
        // A 2xx without a readable result was accepted; do not resend it.
        done =
          settled(await response.text().catch(() => "")) ??
          new Set(due.map((item) => item.record.client_id));
      }
    } catch {
    } finally {
      clearTimeout(abort);
    }
    queue = queue.filter((item) => !done?.has(item.record.client_id));
    for (const item of due)
      if (!done?.has(item.record.client_id)) backoff(item);
    save();
    schedule();
    return queue.length;
  };

  const beacon = () => {
    prune();
    if (!queue.length) return;
    const body = JSON.stringify({ consents: queue.map((item) => item.record) });
    const sendBeacon =
      options.sendBeacon ??
      (typeof navigator !== "undefined" && navigator.sendBeacon
        ? navigator.sendBeacon.bind(navigator)
        : undefined);
    // text/plain is CORS-safelisted, so no preflight is needed and no cookies are sent.
    if (
      sendBeacon?.(
        endpoint,
        new Blob([body], { type: "text/plain;charset=UTF-8" }),
      )
    ) {
      queue = [];
      save();
    }
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") beacon();
  };
  const onOnline = () => {
    for (const item of queue) item.next = 0;
    void log.flush();
  };

  const log: ConsentLog = {
    record(consent, language) {
      try {
        if (problem || destroyed) return;
        const url = win?.location?.origin ?? "";
        const record = toPlatformConsent(consent, {
          url,
          language,
          bannerId: options.bannerId,
          serviceCategories: options.serviceCategories,
        });
        if (seen.has(record.client_id)) return;
        seen.add(record.client_id);
        queue.push({ record, attempts: 0, next: 0 });
        prune();
        save();
        void log.flush();
      } catch {}
    },
    flush() {
      if (problem || destroyed) return Promise.resolve(queue.length);
      sending ??= send().finally(() => {
        sending = undefined;
      });
      return sending;
    },
    pending: () => queue.length,
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      win?.removeEventListener("online", onOnline);
      document?.removeEventListener?.("visibilitychange", onHide);
    },
  };
  if (!problem && win) {
    win.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    schedule();
  }
  return log;
}

/** Record every new decision of a consent runtime. Returns an unsubscribe function. */
export function logConsent(
  consent: {
    get(): ConsentRecord;
    subscribe(listener: (state: ConsentRecord) => void): () => void;
    language?: string | null;
  },
  log: ConsentLog,
): () => void {
  return consent.subscribe((state) =>
    log.record(state, consent.language ?? undefined),
  );
}
