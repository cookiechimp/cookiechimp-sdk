import type { ConsentRuntime, ConsentState } from "./index";
import { fail } from "./internal/dev";
import type { Region } from "./regions";

/** IAB GPP US section prefixes supported by this module (GPP v1.1). */
export type UsSectionName =
  | "usnat"
  | "usca"
  | "usva"
  | "usco"
  | "usut"
  | "usct"
  | "usfl"
  | "usmt"
  | "usor"
  | "ustx"
  | "usde"
  | "usia"
  | "usne"
  | "usnh"
  | "usnj"
  | "ustn";
/** 0 not applicable, 1 yes or opted out, 2 no or did not opt out. */
export type Tristate = 0 | 1 | 2;
export type UsSectionValues = Record<string, number | number[] | boolean>;

type FieldSpec = readonly [name: string, count?: number];
interface SectionSpec {
  id: number;
  version: number;
  gpc: boolean;
  fields: readonly FieldSpec[];
}

const N = "Notice";
const SALE = "SaleOptOut";
const SHARE = "SharingOptOut";
const TA = "TargetedAdvertisingOptOut";
const SDP = "SensitiveDataProcessing";
const KIDS = "KnownChildSensitiveDataConsents";
const MSPA: readonly FieldSpec[] = [
  ["MspaCoveredTransaction"],
  ["MspaOptOutOptionMode"],
  ["MspaServiceProviderMode"],
];
const f = (...names: (string | FieldSpec)[]): FieldSpec[] =>
  names.map((name) => (typeof name === "string" ? [name] : name));

// Later state strings share a layout, with the documented jurisdiction-specific
// sensitive/child counts, notice name, additional consent and GPC differences.
const stateSpec = (
  id: number,
  sensitive: number,
  children = 0,
  sharing = false,
  gpc = true,
  sensitiveNotice = false,
): SectionSpec => ({
  id,
  version: 1,
  gpc,
  fields: [
    ...f(
      `${sharing ? "Sharing" : "Processing"}${N}`,
      `${SALE}${N}`,
      `${TA}${N}`,
      ...(sensitiveNotice ? [`SensitiveDataOptOut${N}`] : []),
      SALE,
      TA,
      [SDP, sensitive],
      children ? [KIDS, children] : KIDS,
      ...(sensitiveNotice ? [] : ["AdditionalDataProcessingConsent"]),
    ),
    ...MSPA,
  ],
});

/** Field order and widths from the IAB GPP section specifications. */
export const US_SECTIONS: Record<UsSectionName, SectionSpec> = {
  usnat: {
    id: 7,
    version: 2,
    gpc: true,
    fields: [
      ...f(
        `Sharing${N}`,
        `${SALE}${N}`,
        `${SHARE}${N}`,
        `${TA}${N}`,
        `${SDP}OptOut${N}`,
        `SensitiveDataLimitUse${N}`,
        SALE,
        SHARE,
        TA,
        [SDP, 16],
        [KIDS, 3],
        "PersonalDataConsents",
      ),
      ...MSPA,
    ],
  },
  usca: {
    id: 8,
    version: 1,
    gpc: true,
    fields: [
      ...f(
        `${SALE}${N}`,
        `${SHARE}${N}`,
        `SensitiveDataLimitUse${N}`,
        SALE,
        SHARE,
        [SDP, 9],
        [KIDS, 2],
        "PersonalDataConsents",
      ),
      ...MSPA,
    ],
  },
  usva: {
    id: 9,
    version: 1,
    gpc: false,
    fields: [
      ...f(`Sharing${N}`, `${SALE}${N}`, `${TA}${N}`, SALE, TA, [SDP, 8], KIDS),
      ...MSPA,
    ],
  },
  usco: {
    id: 10,
    version: 1,
    gpc: true,
    fields: [
      ...f(`Sharing${N}`, `${SALE}${N}`, `${TA}${N}`, SALE, TA, [SDP, 7], KIDS),
      ...MSPA,
    ],
  },
  usut: {
    id: 11,
    version: 1,
    gpc: false,
    fields: [
      ...f(
        `Sharing${N}`,
        `${SALE}${N}`,
        `${TA}${N}`,
        `${SDP}OptOut${N}`,
        SALE,
        TA,
        [SDP, 8],
        KIDS,
      ),
      ...MSPA,
    ],
  },
  usct: {
    id: 12,
    version: 1,
    gpc: true,
    fields: [
      ...f(
        `Sharing${N}`,
        `${SALE}${N}`,
        `${TA}${N}`,
        SALE,
        TA,
        [SDP, 8],
        [KIDS, 3],
      ),
      ...MSPA,
    ],
  },
  usfl: stateSpec(13, 8, 3, false, false),
  usmt: stateSpec(14, 8, 3, true),
  usor: stateSpec(15, 11, 3),
  ustx: stateSpec(16, 8),
  usde: stateSpec(17, 9, 5),
  usia: stateSpec(18, 8, 0, false, true, true),
  usne: stateSpec(19, 8),
  usnh: stateSpec(20, 8, 3),
  usnj: stateSpec(21, 10, 5),
  ustn: stateSpec(22, 8),
};

const STATE_SECTIONS: Record<string, UsSectionName> = {
  CA: "usca",
  VA: "usva",
  CO: "usco",
  UT: "usut",
  CT: "usct",
  FL: "usfl",
  MT: "usmt",
  OR: "usor",
  TX: "ustx",
  DE: "usde",
  IA: "usia",
  NE: "usne",
  NH: "usnh",
  NJ: "usnj",
  TN: "ustn",
};
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const int = (value: number, bits: number) =>
  value.toString(2).padStart(bits, "0").slice(-bits);

function base64(bits: string): string {
  while (bits.length % 8) bits += "0";
  while (bits.length % 6) bits += "0";
  let out = "";
  for (let i = 0; i < bits.length; i += 6)
    out += B64[Number.parseInt(bits.slice(i, i + 6), 2)];
  return out;
}

function unbase64(value: string): string | null {
  let bits = "";
  for (const char of value) {
    const n = B64.indexOf(char);
    if (n < 0) return null;
    bits += int(n, 6);
  }
  return bits;
}

function fibonacci(value: number): string {
  const fib: number[] = [];
  for (let a = 1, b = 2; a <= value; [a, b] = [b, a + b]) fib.push(a);
  let bits = "1";
  for (const n of fib.reverse()) {
    const used = n <= value;
    if (used) value -= n;
    bits = `${used ? 1 : 0}${bits}`;
  }
  return bits;
}

/** Encode the GPP header: type 3, version 1, Fibonacci section ID ranges. */
export function encodeHeader(ids: readonly number[]): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const id of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1] === id - 1) last.push(id);
    else groups.push([id]);
  }
  let bits = int(3, 6) + int(1, 6) + int(groups.length, 12);
  let offset = 0;
  for (const group of groups) {
    const start = group[0] as number;
    const end = group[group.length - 1] as number;
    bits +=
      start === end
        ? `0${fibonacci(start - offset)}`
        : `1${fibonacci(start - offset)}${fibonacci(end - start)}`;
    offset = end;
  }
  return base64(bits);
}

function clamp(value: unknown, fallback: number): number {
  return value === 0 || value === 1 || value === 2 ? value : fallback;
}

/** Encode one US section; unknown or invalid values fall back to 0 (MSPA covered to 1). */
export function encodeSection(
  name: UsSectionName,
  values: UsSectionValues = {},
): string {
  const spec = US_SECTIONS[name];
  let bits = int(spec.version, 6);
  for (const [field, count] of spec.fields) {
    const fallback = field === "MspaCoveredTransaction" ? 1 : 0;
    const value = values[field];
    if (count) {
      for (let i = 0; i < count; i++)
        bits += int(clamp(Array.isArray(value) ? value[i] : 0, 0), 2);
    } else {
      const n = clamp(value, fallback);
      bits += int(fallback === 1 && n === 0 ? 1 : n, 2);
    }
  }
  let encoded = base64(bits);
  if (spec.gpc) encoded += `.${base64(`01${values.Gpc === true ? 1 : 0}`)}`;
  return encoded;
}

/** Decode one US section into its named fields, or null when malformed. */
export function decodeSection(
  name: UsSectionName,
  encoded: string,
): UsSectionValues | null {
  const spec = US_SECTIONS[name];
  const [core = "", gpc] = encoded.split(".");
  const bits = unbase64(core);
  if (!bits || Number.parseInt(bits.slice(0, 6), 2) !== spec.version)
    return null;
  const out: UsSectionValues = { Version: spec.version };
  let at = 6;
  const read = () => {
    const n = Number.parseInt(bits.slice(at, at + 2), 2);
    at += 2;
    return n;
  };
  for (const [field, count] of spec.fields) {
    if (at + 2 * (count ?? 1) > bits.length) return null;
    out[field] = count ? Array.from({ length: count }, read) : read();
  }
  if (spec.gpc) {
    const g = gpc === undefined ? null : unbase64(gpc);
    out.GpcSegmentType = 1;
    out.GpcSegmentIncluded = g !== null;
    out.Gpc = g?.[2] === "1";
  }
  return out;
}

/** Join a header and sections (ascending ID) into a full GPP string. */
export function encodeGpp(
  sections: Partial<Record<UsSectionName, UsSectionValues>>,
): string {
  const names = (Object.keys(sections) as UsSectionName[])
    .filter((name) => Object.hasOwn(US_SECTIONS, name))
    .sort((a, b) => US_SECTIONS[a].id - US_SECTIONS[b].id);
  return [
    encodeHeader(names.map((name) => US_SECTIONS[name].id)),
    ...names.map((name) => encodeSection(name, sections[name])),
  ].join("~");
}

export interface GppOptions {
  /** IAB assigned CMP ID. 0 until CookieChimp's IAB CMP registration (SPEC item 26). */
  cmpId?: number;
  cmpVersion?: number;
  /** "state" picks the state section where one exists; "national" always uses usnat. */
  approach?: "state" | "national";
  /**
   * Categories whose refusal means the user opted out of sale, sharing and
   * targeted ads. Defaults to the runtime's `saleShareCategories` default.
   * Categories the site does not configure are ignored; if none remain the
   * user counts as opted out (fail-closed).
   */
  optOutCategories?: readonly string[];
  /** Publisher assertions such as notices, sensitive data and MSPA mode, per section. */
  values?: Partial<Record<UsSectionName, UsSectionValues>>;
  /** Override the section chosen from the runtime region. */
  section?: UsSectionName | null;
}

/** Pick the applicable US section for a region, or null outside US opt-out states. */
export function sectionFor(
  region: Region | null,
  approach: "state" | "national" = "state",
): UsSectionName | null {
  if (region?.country !== "US") return null;
  const state =
    region.region && Object.hasOwn(STATE_SECTIONS, region.region)
      ? STATE_SECTIONS[region.region]
      : undefined;
  return approach === "state" && state ? state : "usnat";
}

/**
 * Map consent to a US section. Fail-closed: a category that is not explicitly
 * granted counts as opted out, and GPC forces every opt-out.
 */
export function usValues(
  name: UsSectionName,
  consent: Pick<ConsentState, "categories" | "gpc"> | null,
  gpc: boolean,
  options: Pick<GppOptions, "optOutCategories" | "values"> = {},
): UsSectionValues {
  const categories = (
    options.optOutCategories ?? ["advertising", "marketing"]
  ).filter(
    (category) => consent && Object.hasOwn(consent.categories, category),
  );
  const optedOut =
    gpc ||
    consent === null ||
    categories.length === 0 ||
    categories.some((category) => consent.categories[category] !== true);
  const choice: Tristate = optedOut ? 1 : 2;
  const fields = new Set(US_SECTIONS[name].fields.map(([field]) => field));
  const out: UsSectionValues = { ...options.values?.[name] };
  for (const field of [SALE, SHARE, TA])
    if (fields.has(field)) out[field] = choice;
  if (US_SECTIONS[name].gpc) out.Gpc = gpc;
  return out;
}

type Callback = (data: unknown, success: boolean) => void;
interface Listener {
  id: number;
  callback: Callback;
}
type Gpp = ((
  command: string,
  callback?: Callback,
  parameter?: unknown,
) => unknown) & {
  queue?: unknown[][];
  events?: Listener[];
  lastId?: number;
};
type GppWindow = { __gpp?: Gpp };

export interface GppController {
  /** Current GPP string. */
  readonly gppString: string;
  stop(): void;
}

/**
 * Replace the `__gpp` stub with the full CMP API, replay queued calls and keep
 * the string in sync with the consent runtime.
 */
export function installGpp(
  runtime: ConsentRuntime,
  options: GppOptions = {},
  win: GppWindow = globalThis as GppWindow,
): GppController {
  const cmpId = options.cmpId ?? 0;
  const validCmpId = Number.isInteger(cmpId) && cmpId >= 0 && cmpId <= 4095;
  if (!validCmpId) fail("Invalid GPP cmpId");
  const previous = win.__gpp;
  const listeners: Listener[] = [...(previous?.events ?? [])];
  let lastId = previous?.lastId ?? listeners.length;
  const section =
    options.section === undefined
      ? sectionFor(runtime.region, options.approach)
      : options.section;
  let gppString = "";
  let parsed: Partial<Record<UsSectionName, UsSectionValues>> = {};
  let signalStatus = "not ready";
  const supportedAPIs = (Object.keys(US_SECTIONS) as UsSectionName[]).map(
    (name) => `${US_SECTIONS[name].id}:${name}`,
  );
  const ping = () => ({
    gppVersion: "1.1",
    cmpStatus: "loaded",
    cmpDisplayStatus: runtime.needsDecision ? "visible" : "hidden",
    signalStatus,
    supportedAPIs,
    cmpId: validCmpId ? cmpId : 0,
    cmpVersion: options.cmpVersion ?? 1,
    sectionList: section ? [US_SECTIONS[section].id] : [],
    applicableSections: section ? [US_SECTIONS[section].id] : [-1],
    gppString,
    parsedSections: parsed,
  });
  const emit = (eventName: string, data: unknown) => {
    for (const listener of [...listeners])
      try {
        listener.callback(
          { eventName, listenerId: listener.id, data, pingData: ping() },
          true,
        );
      } catch {
        // A vendor callback must not break the CMP.
      }
  };
  const compute = (state: ConsentState | null) => {
    if (!section) return;
    const values = usValues(
      section,
      state,
      runtime.gpc || state?.gpc === true,
      options,
    );
    gppString = encodeGpp({ [section]: values });
    parsed = {
      [section]: decodeSection(
        section,
        gppString.split("~")[1] ?? "",
      ) as UsSectionValues,
    };
  };
  const lookup = (parameter: unknown) =>
    typeof parameter === "string" ? parameter.split(".") : [];
  const api: Gpp = (command, callback, parameter) => {
    const reply = (data: unknown, success = true) => {
      if (typeof callback === "function")
        try {
          callback(data, success);
        } catch {
          // A vendor callback must not break the CMP.
        }
      return data;
    };
    switch (command) {
      case "ping":
        return reply(ping());
      case "addEventListener": {
        if (typeof callback !== "function") return null;
        const listener = { id: ++lastId, callback };
        listeners.push(listener);
        return reply({
          eventName: "listenerRegistered",
          listenerId: listener.id,
          data: true,
          pingData: ping(),
        });
      }
      case "removeEventListener": {
        const index = listeners.findIndex((l) => l.id === parameter);
        if (index >= 0) listeners.splice(index, 1);
        return reply({
          eventName: "listenerRemoved",
          listenerId: parameter,
          data: index >= 0,
          pingData: ping(),
        });
      }
      case "hasSection": {
        const [name] = lookup(parameter);
        return reply(name !== undefined && Object.hasOwn(parsed, name));
      }
      case "getSection": {
        const [name = ""] = lookup(parameter);
        return reply(
          Object.hasOwn(parsed, name) ? parsed[name as UsSectionName] : null,
        );
      }
      case "getField": {
        const [name, field] = lookup(parameter);
        const values =
          name !== undefined && Object.hasOwn(parsed, name)
            ? parsed[name as UsSectionName]
            : undefined;
        return reply(
          field !== undefined && values && Object.hasOwn(values, field)
            ? values[field]
            : null,
        );
      }
      default:
        return reply(null, false);
    }
  };
  compute(runtime.needsDecision ? null : runtime.get());
  win.__gpp = api;
  for (const call of previous?.queue ?? [])
    if (call[0] !== "addEventListener")
      api(call[0] as string, call[1] as Callback, call[2]);
  signalStatus = "ready";
  emit("cmpStatus", "loaded");
  emit("signalStatus", "ready");
  const unsubscribe = runtime.subscribe((state) => {
    signalStatus = "not ready";
    emit("signalStatus", "not ready");
    compute(state);
    if (section) emit(section, parsed[section]);
    signalStatus = "ready";
    emit("signalStatus", "ready");
  });
  return {
    get gppString() {
      return gppString;
    },
    stop() {
      unsubscribe();
      if (win.__gpp === api) delete win.__gpp;
    },
  };
}
