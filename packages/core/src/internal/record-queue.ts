import type { ConsentRecord } from "../index";

const DAY = 86400000;

/** Options shared by every consent record destination. */
export interface RecordQueueOptions {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  fetch?: typeof fetch;
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

interface Queued<R> {
  record: R;
  attempts: number;
  next: number;
}

export const isDev = () =>
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/** An https URL, or http on localhost in development. No credentials or hash. */
export function secureUrl(value: string, base?: string): URL | undefined {
  try {
    const url = new URL(value, base);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    if (url.username || url.password || url.hash) return;
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" && local && isDev())
    )
      return url;
  } catch {}
}

export const short = (value: unknown, max: number) =>
  typeof value === "string" && value.length <= max ? value : undefined;

export const origin = () =>
  typeof window === "undefined" ? "" : (window.location?.origin ?? "");

/**
 * Persisted, capped queue that POSTs records with exponential backoff.
 * Responses are untrusted. Requests never carry cookies.
 */
export function createRecordQueue<R>(
  options: RecordQueueOptions & {
    endpoint: string;
    key: string;
    problem: string | undefined;
    label: string;
    build(consent: ConsentRecord, language?: string): R;
    id(record: R): string;
    ts(record: R): string;
    body(records: R[]): unknown;
    /** Ids that left the queue, from a 2xx body; undefined means all of them. */
    settled?(body: string): Set<string> | undefined;
  },
): ConsentLog {
  const { problem, endpoint, key } = options;
  if (problem && isDev())
    throw new TypeError(`CookieChimp ${options.label}: ${problem}`);
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const maxQueue = options.maxQueue ?? 50;
  const maxAge = options.maxAgeMs ?? 30 * DAY;
  let storage: RecordQueueOptions["storage"];
  try {
    storage =
      options.storage === undefined ? globalThis.localStorage : options.storage;
  } catch {}
  const win = typeof window === "undefined" ? undefined : window;
  let queue: Queued<R>[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sending: Promise<number> | undefined;
  let destroyed = false;
  const seen = new Set<string>();
  const id = (item: Queued<R>) => options.id(item.record);

  const prune = () => {
    const cutoff = now() - maxAge;
    queue = queue
      .filter((item) => Date.parse(options.ts(item.record)) >= cutoff)
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
    if (Array.isArray(parsed))
      queue = parsed.filter((item: Queued<R> | null) => {
        try {
          return (
            typeof item === "object" &&
            item !== null &&
            typeof item.attempts === "number" &&
            typeof item.next === "number" &&
            typeof options.id(item.record) === "string" &&
            typeof options.ts(item.record) === "string"
          );
        } catch {
          return false;
        }
      });
  } catch {}
  prune();
  for (const item of queue) seen.add(id(item));

  const schedule = () => {
    if (destroyed || problem || !queue.length) return;
    clearTimeout(timer);
    const next = Math.min(...queue.map((item) => item.next));
    timer = setTimeout(() => void log.flush(), Math.max(0, next - now()));
  };
  const backoff = (item: Queued<R>) => {
    item.attempts += 1;
    const delay = Math.min(
      options.maxDelayMs ?? 300000,
      (options.baseDelayMs ?? 2000) * 2 ** (item.attempts - 1),
    );
    item.next = Math.ceil(now() + delay * (0.5 + random() / 2));
  };

  // `plain` sends everything as text/plain: CORS-safelisted, so a hidden page
  // needs no preflight. keepalive lets it outlive the page, and unlike
  // sendBeacon the request carries no cookies.
  const send = async (plain?: boolean): Promise<number> => {
    prune();
    const due = queue.filter((item) => plain || item.next <= now());
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
        headers: {
          "Content-Type": plain
            ? "text/plain;charset=UTF-8"
            : "application/json",
        },
        body: JSON.stringify(options.body(due.map((item) => item.record))),
        credentials: "omit",
        keepalive: true,
        redirect: "error",
        signal: controller.signal,
      });
      if (response.ok) {
        // A 2xx without a readable result was accepted; do not resend it.
        let text = "";
        try {
          text = await response.text();
        } catch {}
        done = options.settled?.(text) ?? new Set(due.map(id));
      }
    } catch {
    } finally {
      clearTimeout(abort);
    }
    queue = queue.filter((item) => !done?.has(id(item)));
    for (const item of due) if (!done?.has(id(item))) backoff(item);
    save();
    schedule();
    return queue.length;
  };
  const run = (plain?: boolean) => {
    if (problem || destroyed) return Promise.resolve(queue.length);
    sending ??= send(plain).finally(() => {
      sending = undefined;
    });
    return sending;
  };

  const onHide = () => {
    if (document.visibilityState === "hidden") void run(true);
  };
  const onOnline = () => {
    for (const item of queue) item.next = 0;
    void log.flush();
  };

  const log: ConsentLog = {
    record(consent, language) {
      try {
        if (problem || destroyed) return;
        const record = options.build(consent, language);
        const recordId = options.id(record);
        if (seen.has(recordId)) return;
        seen.add(recordId);
        queue.push({ record, attempts: 0, next: 0 });
        prune();
        save();
        void log.flush();
      } catch {}
    },
    flush: () => run(),
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
