import type { ConsentRuntime, ConsentState } from "./index";
import { isDev } from "./internal/dev";

/** TCF v2.3 Global Vendor List subset used to build TC strings. */
export interface GvlVendor {
  id: number;
  /** Display name, rendered as text only. */
  name?: string;
  purposes: number[];
  legIntPurposes: number[];
  flexiblePurposes?: number[];
  specialPurposes?: number[];
  specialFeatures?: number[];
  deletedDate?: string;
}
export interface GvlName {
  name: string;
  description?: string;
}
export interface Gvl {
  vendorListVersion: number;
  tcfPolicyVersion: number;
  /** Purpose and special feature names for the vendor UI. */
  purposes?: Record<string, GvlName>;
  specialFeatures?: Record<string, GvlName>;
  vendors: Record<string, GvlVendor>;
}

/** User choices for one TC string. All sets hold 1-based IDs. */
export interface TcModel {
  cmpId: number;
  cmpVersion: number;
  consentScreen: number;
  consentLanguage: string;
  vendorListVersion: number;
  tcfPolicyVersion: number;
  /** Day-level timestamp in ms; Created and LastUpdated share it. */
  updated: number;
  useNonStandardTexts?: boolean;
  purposeOneTreatment?: boolean;
  publisherCC: string;
  specialFeatureOptins: ReadonlySet<number>;
  purposeConsents: ReadonlySet<number>;
  purposeLegitimateInterests: ReadonlySet<number>;
  vendorConsents: ReadonlySet<number>;
  vendorLegitimateInterests: ReadonlySet<number>;
  disclosedVendors: ReadonlySet<number>;
  publisherConsents?: ReadonlySet<number>;
  publisherLegitimateInterests?: ReadonlySet<number>;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const int = (value: number, bits: number) =>
  Math.max(0, Math.floor(value)).toString(2).padStart(bits, "0").slice(-bits);
const letters = (code: string) => {
  const upper = /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : "AA";
  return int(upper.charCodeAt(0) - 65, 6) + int(upper.charCodeAt(1) - 65, 6);
};
const field = (set: ReadonlySet<number>, length: number) => {
  let bits = "";
  for (let id = 1; id <= length; id++) bits += set.has(id) ? "1" : "0";
  return bits;
};

function base64(bits: string): string {
  if (bits.length % 24) bits += "0".repeat(24 - (bits.length % 24));
  let out = "";
  for (let i = 0; i < bits.length; i += 6)
    out += B64[Number.parseInt(bits.slice(i, i + 6), 2)];
  return out;
}

/** Vendor section: bitfield or range encoding, whichever is shorter. */
export function encodeVendors(set: ReadonlySet<number>): string {
  const ids = [...set]
    .filter((id) => Number.isInteger(id) && id > 0 && id < 65536)
    .sort((a, b) => a - b);
  const max = ids[ids.length - 1] ?? 0;
  let range = "";
  let count = 0;
  for (let i = 0; i < ids.length; i++) {
    const start = ids[i] as number;
    let end = start;
    while (ids[i + 1] === end + 1) end = ids[++i] as number;
    range +=
      start === end
        ? `0${int(start, 16)}`
        : `1${int(start, 16)}${int(end, 16)}`;
    count++;
  }
  const bitfield = field(new Set(ids), max);
  const ranged = int(count, 12) + range;
  return (
    int(max, 16) +
    (ranged.length < bitfield.length ? `1${ranged}` : `0${bitfield}`)
  );
}

/** Encode a TC string: core, the mandatory disclosed vendors segment, and an optional publisher TC segment. */
export function encodeTcString(model: TcModel): string {
  const day = Math.round(model.updated / 100);
  // TCF v2.2+: legitimate interest is not allowed for purposes 3 to 6.
  const li = new Set(
    [...model.purposeLegitimateInterests].filter((id) => id < 3 || id > 6),
  );
  const core =
    int(2, 6) +
    int(day, 36) +
    int(day, 36) +
    int(model.cmpId, 12) +
    int(model.cmpVersion, 12) +
    int(model.consentScreen, 6) +
    letters(model.consentLanguage) +
    int(model.vendorListVersion, 12) +
    int(model.tcfPolicyVersion, 6) +
    "1" +
    (model.useNonStandardTexts ? "1" : "0") +
    field(model.specialFeatureOptins, 12) +
    field(model.purposeConsents, 24) +
    field(li, 24) +
    (model.purposeOneTreatment ? "1" : "0") +
    letters(model.publisherCC) +
    encodeVendors(model.vendorConsents) +
    encodeVendors(model.vendorLegitimateInterests) +
    int(0, 12);
  const segments = [
    base64(core),
    base64(int(1, 3) + encodeVendors(model.disclosedVendors)),
  ];
  if (model.publisherConsents || model.publisherLegitimateInterests)
    segments.push(
      base64(
        int(3, 3) +
          field(model.publisherConsents ?? new Set(), 24) +
          field(model.publisherLegitimateInterests ?? new Set(), 24) +
          int(0, 6),
      ),
    );
  return segments.join(".");
}

const ids = (value: unknown, max: number): number[] | null =>
  Array.isArray(value) &&
  value.every((id) => Number.isInteger(id) && id > 0 && id <= max)
    ? (value as number[])
    : null;

const text = (value: unknown, max = 256): string | null =>
  typeof value === "string" && value.trim() && value.length <= max
    ? value.trim()
    : null;
function names(input: unknown, max: number): Record<string, GvlName> {
  const out: Record<string, GvlName> = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const id = Number(key);
    const v = value as Record<string, unknown> | null;
    const name = text(v?.name);
    if (!Number.isInteger(id) || id < 1 || id > max || !name) continue;
    const description = text(v?.description, 2000);
    out[key] = description ? { name, description } : { name };
  }
  return out;
}

/** Validate an untrusted GVL payload. Invalid vendors are dropped; an invalid list returns null. */
export function parseGvl(input: unknown): Gvl | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const version = raw.vendorListVersion;
  const policy = raw.tcfPolicyVersion;
  if (
    !Number.isInteger(version) ||
    (version as number) < 1 ||
    (version as number) > 4095 ||
    !Number.isInteger(policy) ||
    (policy as number) < 4 ||
    (policy as number) > 63 ||
    !raw.vendors ||
    typeof raw.vendors !== "object"
  )
    return null;
  const vendors: Record<string, GvlVendor> = {};
  for (const [key, value] of Object.entries(
    raw.vendors as Record<string, unknown>,
  )) {
    const v = value as Record<string, unknown> | null;
    const id = Number(key);
    if (!v || v.id !== id || !Number.isInteger(id) || id < 1 || id > 65535)
      continue;
    const purposes = ids(v.purposes, 24);
    const legIntPurposes = ids(v.legIntPurposes ?? [], 24);
    const specialFeatures = ids(v.specialFeatures ?? [], 12);
    if (!purposes || !legIntPurposes || !specialFeatures) continue;
    vendors[key] = {
      id,
      ...(text(v.name) ? { name: text(v.name) as string } : {}),
      purposes,
      legIntPurposes,
      specialFeatures,
      ...(typeof v.deletedDate === "string"
        ? { deletedDate: v.deletedDate }
        : {}),
    };
  }
  return {
    vendorListVersion: version as number,
    tcfPolicyVersion: policy as number,
    purposes: names(raw.purposes, 24),
    specialFeatures: names(raw.specialFeatures, 12),
    vendors,
  };
}

/** Explicit per-purpose and per-vendor choices from the vendor UI. */
export interface TcfChoices {
  purposes: readonly number[];
  vendors: readonly number[];
  specialFeatures: readonly number[];
  /** Right to object: purposes whose legitimate interest the user refused. */
  purposeObjections: readonly number[];
  /** Right to object: vendors whose legitimate interest the user refused. */
  vendorObjections: readonly number[];
}

const choiceKeys = [
  "purposes",
  "vendors",
  "specialFeatures",
  "purposeObjections",
  "vendorObjections",
] as const;
const choiceMax = {
  purposes: 24,
  vendors: 65535,
  specialFeatures: 12,
  purposeObjections: 24,
  vendorObjections: 65535,
};

/** Validate untrusted choices (for example from storage). Returns null when malformed. */
export function parseChoices(input: unknown): TcfChoices | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out = {} as Record<(typeof choiceKeys)[number], number[]>;
  for (const key of choiceKeys) {
    const list = ids(raw[key] ?? [], choiceMax[key]);
    if (!list || list.length > 5000) return null;
    out[key] = [...new Set(list)];
  }
  return out;
}

/** Default category to TCF purpose mapping. Necessary maps to nothing. */
export const DEFAULT_PURPOSES: Readonly<Record<string, readonly number[]>> = {
  advertising: [1, 2, 3, 4, 7, 9, 10],
  marketing: [1, 2, 3, 4, 7, 9, 10],
  analytics: [1, 8, 9, 10],
  personalization: [1, 5, 6, 11],
  preferences: [1, 5, 6, 11],
  functional: [1, 11],
};
/** Purposes eligible for legitimate interest under TCF v2.2+. */
const LI_PURPOSES = [2, 7, 8, 9, 10, 11];

export interface TcfOptions {
  /** IAB assigned CMP ID. Required in production; see `resolveCmpId`. */
  cmpId?: number;
  cmpVersion?: number;
  consentScreen?: number;
  /** Validated GVL object, or a loader returning the untrusted GVL JSON. */
  gvl: Gvl | (() => Promise<unknown>);
  /** Vendor IDs the publisher works with. Defaults to every non-deleted GVL vendor. */
  vendors?: readonly number[];
  /** Category to purpose mapping, merged over `DEFAULT_PURPOSES`. */
  purposes?: Readonly<Record<string, readonly number[] | null>>;
  /** Publisher country code (ISO 3166-1 alpha-2). Defaults to AA, the reference default. */
  publisherCC?: string;
  /**
   * Where explicit vendor UI choices persist (IDs only, tied to the consent
   * decision timestamp). Defaults to localStorage; pass null to keep them in memory.
   */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  /** Category to special feature mapping (opt-in only; empty by default). */
  specialFeatures?: Readonly<Record<string, readonly number[]>>;
}

const PREFIX = "CookieChimp TCF:";

/**
 * Resolve the CMP ID. A missing value defaults to 0 in development only, with
 * a warning; in production it disables TCF. An invalid value (or 0 in
 * production) throws in development and disables TCF in production.
 */
export function resolveCmpId(cmpId: unknown): number | null {
  const dev = isDev();
  if (cmpId === undefined) {
    if (dev) {
      console.warn(
        `${PREFIX} cmpId is not set, using 0 in development only. Set your IAB assigned CMP ID; production disables TCF without it.`,
      );
      return 0;
    }
    console.error(
      `${PREFIX} cmpId is required in production; TCF is disabled.`,
    );
    return null;
  }
  const valid =
    Number.isInteger(cmpId) &&
    (cmpId as number) >= (dev ? 0 : 1) &&
    (cmpId as number) <= 4095;
  if (valid) {
    if (cmpId === 0)
      console.warn(
        `${PREFIX} cmpId 0 is for development only; production disables TCF.`,
      );
    return cmpId as number;
  }
  const message = `${PREFIX} invalid cmpId ${String(cmpId)}; expected the IAB assigned integer 1 to 4095.`;
  if (dev) throw new TypeError(message);
  console.error(`${message} TCF is disabled.`);
  return null;
}

type Callback = (data: unknown, success: boolean) => void;
type TcfApi = ((
  command: string,
  version?: unknown,
  callback?: Callback,
  parameter?: unknown,
) => void) & {
  queue?: unknown[][];
  gdprApplies?: boolean;
};
type TcfWindow = { __tcfapi?: TcfApi };

export interface TcfController {
  readonly enabled: boolean;
  readonly tcString: string;
  /** Resolves once the GVL is loaded (or TCF is disabled). */
  readonly ready: Promise<void>;
  /** The validated GVL once loaded. */
  readonly gvl: Gvl | null;
  /** The current TC model (null before load or outside GDPR). */
  readonly model: TcModel | null;
  /**
   * Save explicit vendor UI choices. Records a consent decision first when
   * none exists, then emits useractioncomplete.
   */
  setChoices(choices: TcfChoices): boolean;
  /** Notified whenever the model changes. */
  subscribe(listener: () => void): () => void;
  stop(): void;
}

const flags = (set: ReadonlySet<number>, max: number) => {
  const out: Record<string, boolean> = {};
  for (let id = 1; id <= max; id++) out[id] = set.has(id);
  return out;
};
const vendorFlags = (set: ReadonlySet<number>) => {
  const out: Record<string, boolean> = {};
  for (const id of set) out[id] = true;
  return out;
};

/** Build the TC model from a consent state. Fail-closed: no state means no consent. */
export function tcModelFor(
  state: Pick<ConsentState, "categories" | "ts"> | null,
  gvl: Gvl,
  base: Pick<
    TcModel,
    "cmpId" | "cmpVersion" | "consentScreen" | "consentLanguage" | "publisherCC"
  >,
  options: Pick<TcfOptions, "vendors" | "purposes" | "specialFeatures"> = {},
  now = Date.now(),
  choices: TcfChoices | null = null,
): TcModel {
  const mapping: Record<string, readonly number[] | null> = {
    ...DEFAULT_PURPOSES,
    ...options.purposes,
  };
  const granted = new Set<number>();
  for (const [category, purposes] of Object.entries(mapping))
    if (state?.categories[category] === true)
      for (const id of purposes ?? [])
        if (Number.isInteger(id) && id >= 1 && id <= 24) granted.add(id);
  const allowed = options.vendors ? new Set(options.vendors) : null;
  const disclosed = new Set<number>();
  const consents = new Set<number>();
  const li = new Set<number>();
  const features = new Set<number>();
  for (const [category, list] of Object.entries(options.specialFeatures ?? {}))
    if (state?.categories[category] === true)
      for (const id of list)
        if (Number.isInteger(id) && id >= 1 && id <= 12) features.add(id);
  for (const vendor of Object.values(gvl.vendors)) {
    if (vendor.deletedDate || (allowed && !allowed.has(vendor.id))) continue;
    disclosed.add(vendor.id);
    if (
      vendor.purposes.length > 0 &&
      vendor.purposes.every((id) => granted.has(id)) &&
      (vendor.specialFeatures ?? []).every((id) => features.has(id))
    )
      consents.add(vendor.id);
    if (vendor.legIntPurposes.some((id) => LI_PURPOSES.includes(id)))
      li.add(vendor.id);
  }
  if (state && choices) {
    // Explicit choices replace the category mapping, limited to what was disclosed.
    granted.clear();
    for (const id of choices.purposes) granted.add(id);
    features.clear();
    for (const id of choices.specialFeatures) features.add(id);
    consents.clear();
    for (const id of choices.vendors) if (disclosed.has(id)) consents.add(id);
    for (const id of choices.vendorObjections) li.delete(id);
  }
  const ts = state ? Date.parse(state.ts) : Number.NaN;
  const time = Number.isFinite(ts) ? ts : now;
  const date = new Date(time);
  return {
    ...base,
    vendorListVersion: gvl.vendorListVersion,
    tcfPolicyVersion: gvl.tcfPolicyVersion,
    updated: Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
    specialFeatureOptins: features,
    purposeConsents: granted,
    purposeLegitimateInterests: new Set(
      LI_PURPOSES.filter(
        (id) => !(state && choices?.purposeObjections.includes(id)),
      ),
    ),
    vendorConsents: consents,
    vendorLegitimateInterests: li,
    disclosedVendors: disclosed,
  };
}

/**
 * Replace the `__tcfapi` stub with the TCF v2.3 CMP API (apiVersion 2.2
 * commands) and keep the TC string in sync with the consent runtime.
 */
export function installTcf(
  runtime: ConsentRuntime,
  options: TcfOptions,
  win: TcfWindow = globalThis as TcfWindow,
): TcfController {
  const cmpId = resolveCmpId(options.cmpId);
  const previous = win.__tcfapi;
  const queue = previous?.queue ?? [];
  const gdprApplies = runtime.regulation === "gdpr";
  const listeners = new Map<number, Callback>();
  let lastId = 0;
  let status: "loading" | "loaded" | "error" = "loading";
  let gvl: Gvl | null = null;
  let model: TcModel | null = null;
  let tcString = "";
  let eventStatus = "tcloaded";
  let stopped = false;
  let choices: TcfChoices | null = null;
  let saving = false;
  const watchers = new Set<() => void>();
  const KEY = "cc_tcf_choices";
  const storage = (() => {
    if (options.storage !== undefined) return options.storage;
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  })();
  const load = (state: ConsentState | null) => {
    choices = null;
    if (!state || !storage) return;
    try {
      const raw = JSON.parse(storage.getItem(KEY) ?? "null");
      if (raw?.ts === state.ts) choices = parseChoices(raw.choices);
      else storage.removeItem(KEY);
    } catch {
      choices = null;
    }
  };

  const ping = () => ({
    gdprApplies,
    cmpLoaded: status === "loaded",
    cmpStatus: status === "loading" ? "stub" : status,
    displayStatus: !gdprApplies
      ? "disabled"
      : runtime.needsDecision
        ? "visible"
        : "hidden",
    apiVersion: "2.2",
    cmpVersion: status === "error" ? undefined : (options.cmpVersion ?? 1),
    cmpId: cmpId ?? undefined,
    gvlVersion: gvl?.vendorListVersion,
    tcfPolicyVersion: gvl?.tcfPolicyVersion,
  });
  const tcData = (listenerId?: number) => {
    const m = model;
    const empty = new Set<number>();
    return {
      tcString,
      tcfPolicyVersion: gvl?.tcfPolicyVersion,
      cmpId,
      cmpVersion: options.cmpVersion ?? 1,
      gdprApplies,
      eventStatus,
      cmpStatus: "loaded",
      listenerId,
      isServiceSpecific: true,
      useNonStandardTexts: false,
      publisherCC: m?.publisherCC ?? "AA",
      purposeOneTreatment: false,
      purpose: {
        consents: flags(m?.purposeConsents ?? empty, 11),
        legitimateInterests: flags(m?.purposeLegitimateInterests ?? empty, 11),
      },
      vendor: {
        consents: vendorFlags(m?.vendorConsents ?? empty),
        legitimateInterests: vendorFlags(m?.vendorLegitimateInterests ?? empty),
        disclosedVendors: vendorFlags(m?.disclosedVendors ?? empty),
      },
      specialFeatureOptins: flags(m?.specialFeatureOptins ?? empty, 2),
      publisher: {
        consents: {},
        legitimateInterests: {},
        customPurpose: { consents: {}, legitimateInterests: {} },
        restrictions: {},
      },
    };
  };
  const safe = (callback: Callback, data: unknown, ok: boolean) => {
    try {
      callback(data, ok);
    } catch {
      // A vendor callback must not break the CMP.
    }
  };
  const notify = () => {
    for (const [id, callback] of listeners) safe(callback, tcData(id), true);
    for (const watcher of [...watchers])
      try {
        watcher();
      } catch {
        // UI watchers must not break the CMP.
      }
  };
  const compute = (state: ConsentState | null) => {
    if (!gvl || cmpId === null) return;
    if (!gdprApplies) {
      model = null;
      tcString = "";
      return;
    }
    model = tcModelFor(
      state,
      gvl,
      {
        cmpId,
        cmpVersion: options.cmpVersion ?? 1,
        consentScreen: options.consentScreen ?? 1,
        consentLanguage: (runtime.language || "en").slice(0, 2),
        publisherCC: options.publisherCC ?? "AA",
      },
      options,
      Date.now(),
      choices,
    );
    tcString = encodeTcString(model);
  };

  const api: TcfApi = (command, version, callback, parameter) => {
    if (typeof callback !== "function") return;
    if (command === "ping") return safe(callback, ping(), true);
    // Error state: answer ping only (CMP API v2), so vendors fail closed.
    if (status === "error") return;
    if (version !== 2 && version !== undefined && version !== null)
      return safe(callback, null, false);
    if (status === "loading") {
      queue.push([command, version, callback, parameter]);
      return;
    }
    if (command === "addEventListener") {
      const id = ++lastId;
      listeners.set(id, callback);
      return safe(callback, tcData(id), true);
    }
    if (command === "removeEventListener")
      return safe(callback, listeners.delete(parameter as number), true);
    // getTCData is deprecated in TCF v2.2; other commands are unsupported.
    return safe(callback, null, false);
  };
  win.__tcfapi = api;

  const flush = () => {
    for (const call of queue.splice(0))
      api(call[0] as string, call[1], call[2] as Callback, call[3]);
  };
  const fail = (reason: string) => {
    status = "error";
    queue.length = 0;
    console.error(`${PREFIX} ${reason}; TCF is disabled.`);
  };

  let unsubscribe = () => {};
  const ready = (async () => {
    if (cmpId === null) return fail("no valid cmpId");
    let loaded: Gvl | null = null;
    try {
      loaded =
        typeof options.gvl === "function"
          ? parseGvl(await options.gvl())
          : parseGvl(options.gvl);
    } catch {
      loaded = null;
    }
    if (stopped) return;
    if (!loaded) return fail("the Global Vendor List is missing or invalid");
    gvl = loaded;
    eventStatus =
      gdprApplies && runtime.needsDecision ? "cmpuishown" : "tcloaded";
    const initial = runtime.needsDecision ? null : runtime.get();
    load(initial);
    compute(initial);
    status = "loaded";
    flush();
    unsubscribe = runtime.subscribe((state) => {
      if (saving) return;
      eventStatus = "useractioncomplete";
      // A new decision replaces earlier vendor choices unless they belong to it.
      load(state);
      compute(state);
      notify();
    });
    for (const watcher of [...watchers]) watcher();
  })();

  return {
    get enabled() {
      return status !== "error";
    },
    get tcString() {
      return tcString;
    },
    ready,
    get gvl() {
      return gvl;
    },
    get model() {
      return model;
    },
    setChoices(input) {
      const parsed = parseChoices(input);
      if (!parsed || status !== "loaded" || !gdprApplies) return false;
      if (runtime.needsDecision) {
        saving = true;
        try {
          runtime.set(runtime.get().categories);
        } finally {
          saving = false;
        }
      }
      const state = runtime.get();
      choices = parsed;
      try {
        storage?.setItem(
          KEY,
          JSON.stringify({ ts: state.ts, choices: parsed }),
        );
      } catch {
        // Storage full or blocked: keep the choices for this page view.
      }
      eventStatus = "useractioncomplete";
      compute(state);
      notify();
      return true;
    },
    subscribe(listener) {
      watchers.add(listener);
      return () => watchers.delete(listener);
    },
    stop() {
      stopped = true;
      unsubscribe();
      listeners.clear();
      watchers.clear();
      if (win.__tcfapi === api) delete win.__tcfapi;
    },
  };
}
