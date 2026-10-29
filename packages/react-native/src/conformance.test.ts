// Generates the native SDK conformance suite in spec/mobile from the code the
// React Native SDK ships. The native iOS and Android SDKs run these vectors in
// their own tests, so a behavior change here shows up as a stale fixture.
//
// Check: `pnpm test:unit` fails when a fixture no longer matches.
// Update: `pnpm spec:mobile` from the repository root.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  VERSION as CORE_VERSION,
  type ConsentState,
  createConsent,
  decodeConsentCookie,
  encodeConsentCookie,
} from "@cookiechimp/core";
import { toPlatformConsent } from "@cookiechimp/core/consent-log";
import {
  adaptPlatformConfig,
  type DashboardConfig,
} from "@cookiechimp/core/sync";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { CookieChimp, resetCookieChimp, store } from "./api";
import { appData, label } from "./app-data";
import { toUserPreferences } from "./engine";
import { DEFAULT_CONSENT_MAPPING, firebaseConsent } from "./firebase";
import {
  messages,
  SDK_LANGUAGES,
  sdkLanguage,
  type Translations,
} from "./i18n";
import en from "./locales/en";
import {
  alpha,
  palette,
  plain,
  poweredBy,
  radius,
  rich,
  url,
  withoutBranding,
} from "./presentation";
import { parseRegion, regionKey } from "./region";
import { type AsyncKeyValueStorage, STORAGE_PREFIX } from "./storage";
import { emitAppState, Platform } from "./test/react-native";
import { consentText } from "./text";
import { trackingStatus } from "./tracking";
import { bannerDisplay } from "./ui/banner";
import { clearVendors, serviceId } from "./vendors";

const SPEC = resolve(import.meta.dirname, "../../../spec/mobile");
const UPDATE = process.env.UPDATE_MOBILE_SPEC === "1";
const SPEC_VERSION = 1;
const written = new Set<string>();

function emit(path: string, value: unknown) {
  const file = join(SPEC, path);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  written.add(path);
  if (UPDATE) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    return;
  }
  if (!existsSync(file))
    throw new Error(`spec/mobile/${path} is missing. Run pnpm spec:mobile.`);
  if (readFileSync(file, "utf8") !== text)
    throw new Error(`spec/mobile/${path} is stale. Run pnpm spec:mobile.`);
}

const fixture = (value: { cases: unknown[] } & Record<string, unknown>) => ({
  specVersion: SPEC_VERSION,
  ...value,
});

// biome-ignore lint/suspicious/noExplicitAny: fixture bundles are untyped JSON.
type Json = any;
const clone = <T>(value: T): T => structuredClone(value);
const MAIN = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../core/src/fixtures/platform-offline-bundle.json",
    ),
    "utf8",
  ),
) as Record<string, Json>;
const ACCOUNT = MAIN.account_hashid as string;

/** A second bundle with the edge cases the main fixture does not cover. */
function variantBundle() {
  const bundle = clone(MAIN);
  bundle.account_hashid = "acctVARIANT";
  bundle.cache_version = "v9z8y7x6";
  bundle.version = "7";
  bundle.rtl_languages = ["ar", "he", "EN", 4, "abcd"];
  bundle.cookie_settings = { name: "my consent", expires_days: 400 };
  bundle.reconsent_required_at = "2026-09-01T00:00:00Z";
  bundle.country_banner_map = {
    DE: "bnrDE",
    AT: "bnrMissing",
    "US-CA": "bnrUS1",
    US: "bnrEU1",
  };
  bundle.default_banner = "bnrEU1";
  const de = clone(bundle.banners.bnrEU1);
  de.hashid = "bnrDE";
  de.available_languages = ["de", "en", "ar"];
  de.expires_days = 90;
  de.force_consent = true;
  de.gui_options = {
    layout: "fullscreen",
    position: "top left",
    button_placement: "wide",
    equal_weight_buttons: true,
    swap_buttons: true,
  };
  de.preferences_gui_options = {
    layout: "bar",
    position: "right",
    equal_weight_buttons: true,
    control_level: "category_only",
    show_services: false,
  };
  de.theme = {
    dark_mode: "auto",
    modal_border_radius: "1rem",
    btn_border_radius: 10,
    colors: { bg: "#fafafa", btn_primary_bg: "#0055ff", text_color: "red" },
    dark_colors: { bg: "#000", text_color: "#ccc", btn_primary_bg: "bad;" },
    logo_url_light: "https://example.test/logo.png",
    logo_url_dark: "javascript:alert(1)",
  };
  de.footer = {
    enabled: true,
    content:
      "<p>Fragen? <a href='https://example.test/help'>Hilfe</a> <a href=\"https://cookiechimp.com\">Powered by CookieChimp</a></p>",
    show_powered_by: false,
  };
  bundle.banners.bnrDE = de;
  const deCopy = clone(MAIN.translations.bnrEU1.de);
  deCopy.consent_modal.title = "";
  deCopy.consent_modal.close_btn = "Schließen";
  deCopy.preferences_modal.more_info = "";
  bundle.translations.bnrDE = {
    de: deCopy,
    en: clone(MAIN.translations.bnrEU1.en),
    ar: {
      consent_modal: { title: "خصوصيتك", accept_btn: "قبول الكل" },
      preferences_modal: { title: "تفضيلات الخصوصية" },
    },
  };
  bundle.categories.push({
    slug: "Ads & Marketing!",
    name: "Ads",
    required: false,
    translations: { de: { name: "Werbung", description: "<b>Anzeigen</b>" } },
    services: [
      {
        id: "svcFB",
        name: "Firebase Analytics",
        company: "Google LLC",
        privacy_policy_url: "javascript:alert(1)",
        app_data: {
          collected: ["device_id", "crash_data", "device_id", "", 7],
          purposes: ["analytics", "made_up_purpose"],
          tracking: false,
          retention: "  14 months  ",
          packages: {
            ios: ["FirebaseAnalytics"],
            android: ["com.google.firebase:firebase-analytics"],
          },
        },
        storage_items: [
          { name: "app_instance_id", type: "sdk_storage", duration: "2y" },
          { type: "cookie" },
          {
            name: "_fbp",
            type: "cookie",
            translations: { de: { description: "Werbe-ID" } },
          },
        ],
      },
      { id: "svcDUP", name: "Google Analytics" },
      { id: "svcBLANK", name: "  ###  " },
      { id: "svcUNI", name: "Ünïcode Tracker", accepted_by_default: "yes" },
    ],
    storage_items: [],
  });
  bundle.categories.push({ slug: "", name: "No slug", services: [] });
  return bundle;
}

const VARIANT = variantBundle();
const bundles: Record<string, Record<string, Json>> = {
  main: MAIN,
  variant: VARIANT,
  reconsent: {
    ...clone(MAIN),
    cache_version: "r3c0n5e7",
    reconsent_required_at: "2026-10-20T00:00:00Z",
  },
  updated: (() => {
    const next = clone(MAIN);
    next.cache_version = "e5f6a7b8";
    next.categories[1].services.pop();
    return next;
  })(),
};

const T0 = Date.UTC(2026, 9, 15, 9, 30, 0);
let ids = 0;
const nextId = () =>
  `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`;

function deterministic() {
  ids = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
    nextId as () => `${string}-${string}-${string}-${string}-${string}`,
  );
  vi.spyOn(Math, "random").mockReturnValue(0.5);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const b64 = (text: string | Uint8Array) =>
  Buffer.from(text).toString("base64url");
const cookie = (value: unknown) => `v1.${b64(JSON.stringify(value))}`;
const VALID = {
  schemaVersion: 1,
  consentId: "abcdefghijklmnop",
  ts: "2026-10-01T12:00:00.000Z",
  categories: { necessary: true, analytics: false },
  action: "custom",
};

describe("native conformance fixtures", () => {
  it("bundles", () => {
    for (const [name, bundle] of Object.entries(bundles))
      emit(`fixtures/bundles/${name}.json`, bundle);
  });

  it("codec", () => {
    const states: ConsentState[] = [
      VALID as ConsentState,
      {
        schemaVersion: 1,
        consentId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        ts: "2026-10-15T09:30:00.000Z",
        categories: { necessary: true, analytics: true, marketing: false },
        services: { "google-analytics": true, "meta-pixel": false },
        action: "custom",
        region: { country: "US", region: "CA" },
        regulation: "ccpa",
        gpc: false,
      },
      {
        schemaVersion: 1,
        consentId: "Z_-9Z_-9Z_-9Z_-9",
        ts: "2026-01-02T03:04:05.006Z",
        categories: { necessary: true, "café-ünïcode": true },
        action: "accept_all",
        region: null,
        regulation: "gdpr",
        gpc: true,
      },
    ];
    const decode: [string, string][] = [
      ["minimal state", cookie(VALID)],
      [
        "services, subdivision, regulation and gpc",
        cookie({
          ...VALID,
          services: { a: true, b: false },
          region: { country: "US", region: "CA" },
          regulation: "ccpa",
          gpc: true,
        }),
      ],
      ["region null", cookie({ ...VALID, region: null })],
      ["region country only", cookie({ ...VALID, region: { country: "DE" } })],
      [
        "region without a country is dropped",
        cookie({ ...VALID, region: { region: "CA" } }),
      ],
      [
        "unknown regulation is dropped",
        cookie({ ...VALID, regulation: "lgpd" }),
      ],
      ["non-boolean gpc is dropped", cookie({ ...VALID, gpc: "yes" })],
      ["unknown fields are dropped", cookie({ ...VALID, extra: 1 })],
      ["date-only ts", cookie({ ...VALID, ts: "2026-10-01" })],
      [
        "ts without milliseconds",
        cookie({ ...VALID, ts: "2026-10-01T12:00:00Z" }),
      ],
      ["ts with offset", cookie({ ...VALID, ts: "2026-10-01T14:00:00+02:00" })],
      [
        "64 character consent id",
        cookie({ ...VALID, consentId: "a".repeat(64) }),
      ],
      ["every action", cookie({ ...VALID, action: "gpc_auto" })],
      [
        "necessary false",
        cookie({ ...VALID, categories: { necessary: false } }),
      ],
      [
        "necessary missing",
        cookie({ ...VALID, categories: { analytics: true } }),
      ],
      ["consent id too short", cookie({ ...VALID, consentId: "abc" })],
      ["consent id too long", cookie({ ...VALID, consentId: "a".repeat(65) })],
      [
        "consent id with a dot",
        cookie({ ...VALID, consentId: "abcdefgh.ijklmnop" }),
      ],
      ["ts not a date", cookie({ ...VALID, ts: "not a date" })],
      ["ts missing", cookie({ ...VALID, ts: undefined })],
      ["unknown action", cookie({ ...VALID, action: "accept" })],
      [
        "non-boolean category",
        cookie({ ...VALID, categories: { necessary: true, analytics: 1 } }),
      ],
      [
        "empty category name",
        cookie({ ...VALID, categories: { necessary: true, "": true } }),
      ],
      ["categories array", cookie({ ...VALID, categories: [true] })],
      ["services not an object", cookie({ ...VALID, services: [] })],
      ["non-boolean service", cookie({ ...VALID, services: { a: "true" } })],
      ["schema version 2", cookie({ ...VALID, schemaVersion: 2 })],
      ["schema version string", cookie({ ...VALID, schemaVersion: "1" })],
      ["v2 prefix", `v2.${b64(JSON.stringify(VALID))}`],
      ["no prefix", b64(JSON.stringify(VALID))],
      [
        "standard base64 characters",
        `v1.${Buffer.from(JSON.stringify(VALID)).toString("base64")}+/`,
      ],
      ["padding is not allowed", `v1.${b64(JSON.stringify(VALID))}==`],
      ["empty payload", "v1."],
      ["invalid JSON", `v1.${b64("{not json")}`],
      ["JSON array", `v1.${b64("[1]")}`],
      ["JSON null", `v1.${b64("null")}`],
      ["invalid UTF-8", `v1.${b64(Uint8Array.from([0x7b, 0xff, 0xfe, 0x7d]))}`],
      [
        "over 3800 characters",
        cookie({
          ...VALID,
          categories: { necessary: true, x: true },
          pad: "x".repeat(3000),
        }),
      ],
      ["empty string", ""],
    ];
    emit(
      "fixtures/codec.json",
      fixture({
        description:
          "The v1 consent value: `v1.` plus unpadded base64url of UTF-8 JSON. Decode every `decode` value to `expected` (null means rejected). Every `encode` state must decode back to itself, and the native encoder's output must decode to the same state.",
        maxLength: 3800,
        encode: states.map((state) => ({
          state,
          value: encodeConsentCookie(state),
        })),
        cases: decode.map(([name, value]) => ({
          name,
          value,
          expected: decodeConsentCookie(value),
        })),
      }),
    );
  });

  it("adapt", () => {
    const cases: [string, string, Record<string, unknown>, unknown?][] = [
      ["California, English", "main", { locale: "en-US", region: "US-CA" }],
      ["Germany, German", "main", { locale: "de-DE", region: "DE" }],
      ["country fallback for a state", "main", { region: "US-NY" }],
      ["unmapped country uses the default", "main", { region: "JP" }],
      ["no options", "main", {}],
      ["lower case region", "main", { region: "de", locale: "DE" }],
      ["unavailable language", "main", { locale: "fr-FR", region: "DE" }],
      ["matching projectId", "main", { projectId: ACCOUNT, region: "FR" }],
      ["other projectId", "main", { projectId: "acctOTHER" }],
      ["variant German", "variant", { locale: "de-AT", region: "DE" }],
      ["variant Arabic", "variant", { locale: "ar", region: "DE" }],
      ["variant missing banner falls back", "variant", { region: "AT" }],
      ["variant country map for a state", "variant", { region: "US-TX" }],
      ["variant state map", "variant", { region: "US-CA", locale: "en" }],
      ["schema version 2", "main", {}, { ...clone(MAIN), schema_version: 2 }],
      ["schema version 1", "main", {}, { ...clone(MAIN), schema_version: 1 }],
      [
        "missing cache_version",
        "main",
        {},
        { ...clone(MAIN), cache_version: undefined },
      ],
      [
        "cache_version over 128 characters",
        "main",
        {},
        { ...clone(MAIN), cache_version: "c".repeat(129) },
      ],
      ["missing account", "main", {}, { ...clone(MAIN), account_hashid: 42 }],
      [
        "no usable banner",
        "main",
        {},
        { ...clone(MAIN), default_banner: "nope", country_banner_map: {} },
      ],
      ["array input", "main", {}, [MAIN]],
      ["string input", "main", {}, "{}"],
    ];
    emit(
      "fixtures/adapt.json",
      fixture({
        description:
          "adaptPlatformConfig: the offline bundle (`bundle`, or the inline `input` when present) and options to the SDK's DashboardConfig. Null means the bundle is rejected. Compare as JSON values; absent keys must be absent.",
        cases: cases.map(([name, bundle, options, input]) => ({
          name,
          bundle,
          ...(input !== undefined ? { input } : {}),
          options,
          expected: compact(
            adaptPlatformConfig(input ?? bundles[bundle], options),
            input ?? bundles[bundle],
          ),
        })),
      }),
    );
  });

  it("consent", () => {
    deterministic();
    const dashboard = (region: string) =>
      adaptPlatformConfig(MAIN, { region, locale: "en" }) as DashboardConfig;
    interface Step {
      op: "init" | "acceptAll" | "rejectAll" | "set" | "advance";
      categories?: Record<string, unknown>;
      services?: Record<string, unknown>;
      ms?: number;
    }
    const run = (
      name: string,
      setup: {
        region: string | null;
        regulation: "gdpr" | "ccpa";
        stored?: string;
        cookieName?: string;
        maxAgeDays?: number;
      },
      steps: Step[],
    ) => {
      ids = 0;
      vi.setSystemTime(T0);
      const config = dashboard(setup.region ?? "");
      const data = new Map<string, string>();
      const cookieName = setup.cookieName ?? "cc_consent";
      if (setup.stored) data.set(cookieName, setup.stored);
      const region = parseRegion(setup.region);
      let runtime: ReturnType<typeof createConsent> | undefined;
      const results = steps.map((step) => {
        if (step.op === "advance") {
          vi.setSystemTime(Date.now() + (step.ms ?? 0));
          return { op: step.op, ms: step.ms };
        }
        if (step.op === "init")
          runtime = createConsent({
            categories: config.categories,
            services: config.services,
            regulation: setup.regulation,
            language: config.language,
            promptOnOptOut: true,
            region,
            gpc: false,
            storage: {
              getItem: (key) => data.get(key) ?? null,
              setItem: (key, value) => void data.set(key, value),
            },
            cookie: {
              name: cookieName,
              ...(setup.maxAgeDays ? { maxAge: setup.maxAgeDays * 86400 } : {}),
            },
          });
        else if (step.op === "acceptAll") runtime?.acceptAll();
        else if (step.op === "rejectAll") runtime?.rejectAll();
        else
          runtime?.set({
            categories: step.categories as Record<string, boolean>,
            services: step.services as Record<string, boolean>,
          });
        const consent = runtime as ReturnType<typeof createConsent>;
        const raw = data.get(cookieName);
        return {
          ...step,
          state: consent.get(),
          needsDecision: consent.needsDecision,
          stored: raw ? decodeConsentCookie(raw) : null,
          has: Object.fromEntries(
            [...config.categories.map(({ id }) => id), "necessary", "unknown"]
              .sort()
              .map((id) => [id, consent.has(id)]),
          ),
          hasService: Object.fromEntries(
            [...config.services.map(({ id }) => id), "unknown"]
              .sort()
              .map((id) => [id, consent.hasService(id)]),
          ),
        };
      });
      return { name, setup, steps: results };
    };
    const stored = (value: Partial<ConsentState>) =>
      encodeConsentCookie({
        schemaVersion: 1,
        consentId: "storedconsent0001",
        ts: new Date(T0 - 86_400_000).toISOString(),
        categories: { necessary: true, analytics: true, marketing: false },
        action: "custom",
        region: { country: "DE" },
        regulation: "gdpr",
        gpc: false,
        ...value,
      } as ConsentState);
    const cases = [
      run("GDPR first launch", { region: "DE", regulation: "gdpr" }, [
        { op: "init" },
        { op: "advance", ms: 1000 },
        { op: "acceptAll" },
        { op: "advance", ms: 1000 },
        { op: "rejectAll" },
        { op: "advance", ms: 1000 },
        { op: "set", categories: { analytics: true } },
        { op: "set", services: { "google-analytics": false } },
        {
          op: "set",
          categories: { essential: false, unknown: true, marketing: "yes" },
          services: { "session-management": false, unknown: true },
        },
      ]),
      run("CCPA first launch", { region: "US-CA", regulation: "ccpa" }, [
        { op: "init" },
        { op: "rejectAll" },
        { op: "set", categories: { marketing: true } },
      ]),
      run("no region", { region: null, regulation: "gdpr" }, [
        { op: "init" },
        { op: "acceptAll" },
      ]),
      run(
        "restores a stored decision",
        {
          region: "DE",
          regulation: "gdpr",
          stored: stored({
            categories: { necessary: true, analytics: true, legacy: true },
            services: { "google-analytics": false, retired: true },
          }),
        },
        [{ op: "init" }, { op: "set", categories: { marketing: true } }],
      ),
      run(
        "discards a decision made under another regulation",
        {
          region: "DE",
          regulation: "gdpr",
          stored: stored({ regulation: "ccpa" }),
        },
        [{ op: "init" }],
      ),
      run(
        "keeps a decision without regulation metadata",
        {
          region: "DE",
          regulation: "gdpr",
          stored: stored({ regulation: undefined, region: undefined }),
        },
        [{ op: "init" }],
      ),
      run(
        "ignores an expired decision",
        {
          region: "DE",
          regulation: "gdpr",
          stored: stored({ ts: new Date(T0 - 11 * 86_400_000).toISOString() }),
          maxAgeDays: 10,
        },
        [{ op: "init" }],
      ),
      run(
        "ignores an invalid stored value",
        { region: "DE", regulation: "gdpr", stored: "v1.garbage" },
        [{ op: "init" }],
      ),
      run(
        "custom cookie name",
        { region: "FR", regulation: "gdpr", cookieName: "my_pref" },
        [{ op: "init" }, { op: "acceptAll" }],
      ),
    ];
    emit(
      "fixtures/consent.json",
      fixture({
        description:
          "The consent runtime (core createConsent with mobile options: explicit regulation, promptOnOptOut true, gpc false, storage instead of a cookie). Config comes from adapting bundles/main.json with the case region and locale `en`. Time starts at `now` and only `advance` moves it; consent ids come from `ids` in order. `state` is the public snapshot, `stored` the decoded stored value.",
        now: new Date(T0).toISOString(),
        ids: [nextIdPreview(1), nextIdPreview(2)],
        cases,
      }),
    );
  });

  it("engine", async () => {
    Platform.OS = "ios";
    const scenarios = [
      await scenario("first launch in Germany, accept all", {}, [
        {
          op: "start",
          options: { accountId: ACCOUNT, country: "DE", language: "de-DE" },
        },
        { op: "showPreferences" },
        { op: "hidePreferences" },
        { op: "advance", ms: 2000 },
        { op: "acceptAll" },
        { op: "advance", ms: 2000 },
        { op: "acceptCategory", value: ["analytics"] },
        { op: "advance", ms: 2000 },
        {
          op: "acceptService",
          value: ["Google Analytics"],
          category: "analytics",
        },
        { op: "restart" },
      ]),
      await scenario("California opt-out, reject", {}, [
        {
          op: "start",
          options: { accountId: ACCOUNT, country: "US-CA", language: "en-US" },
        },
        { op: "rejectAll" },
        { op: "acceptCategory", value: "all" },
        { op: "acceptCategory", value: [] },
      ]),
      await scenario("geolocation", { geo: { country: "fr", region: null } }, [
        {
          op: "start",
          options: { accountId: ACCOUNT, geolocation: true, language: "en" },
        },
        { op: "save", categories: { analytics: true }, services: {} },
      ]),
      await scenario("geolocation failure falls back to GDPR", { geo: 500 }, [
        {
          op: "start",
          options: { accountId: ACCOUNT, geolocation: true, language: "en" },
        },
      ]),
      await scenario("cached config revalidates", {}, [
        {
          op: "start",
          options: { accountId: ACCOUNT, country: "DE", language: "en" },
        },
        { op: "restart" },
        { op: "advance", ms: 4 * 60_000 },
        { op: "foreground" },
        { op: "advance", ms: 2 * 60_000 },
        { op: "foreground" },
      ]),
      await scenario(
        "new config version on revalidation",
        { configSequence: ["main", "updated"] },
        [
          {
            op: "start",
            options: { accountId: ACCOUNT, country: "DE", language: "en" },
          },
          { op: "acceptAll" },
          { op: "advance", ms: 6 * 60_000 },
          { op: "foreground" },
        ],
      ),
      await scenario(
        "re-consent date",
        { configSequence: ["main", "reconsent"] },
        [
          {
            op: "start",
            options: { accountId: ACCOUNT, country: "DE", language: "en" },
          },
          { op: "acceptAll" },
          { op: "advance", ms: 6 * 86_400_000 },
          { op: "restart" },
          { op: "advance", ms: 1000 },
          { op: "restart" },
        ],
      ),
      await scenario("decision expires", {}, [
        {
          op: "start",
          options: { accountId: ACCOUNT, country: "DE", language: "en" },
        },
        { op: "acceptAll" },
        { op: "advance", ms: 183 * 86_400_000 },
        { op: "foreground" },
      ]),
      await scenario("offline bundle", {}, [
        {
          op: "start",
          options: { config: "variant", country: "DE", language: "de" },
        },
        { op: "rejectAll" },
        { op: "reset" },
      ]),
      await scenario("offline bundle without sync", {}, [
        {
          op: "start",
          options: {
            config: "main",
            accountId: ACCOUNT,
            syncConsents: false,
            language: "en",
          },
        },
        { op: "acceptAll" },
      ]),
      await scenario("offline bundle for another account", {}, [
        { op: "start", options: { config: "main", accountId: "acctOTHER" } },
      ]),
      await scenario("config unavailable", { configStatus: 503 }, [
        { op: "start", options: { accountId: ACCOUNT, country: "DE" } },
        { op: "foreground" },
      ]),
      await scenario("no account or config", {}, [
        { op: "start", options: { country: "DE" } },
      ]),
      await scenario(
        "record delivery retries",
        { syncSequence: [500, 500, 200] },
        [
          {
            op: "start",
            options: { accountId: ACCOUNT, country: "DE", language: "en" },
          },
          { op: "acceptAll" },
          { op: "flush" },
          { op: "foreground" },
        ],
      ),
      await scenario("server rejects a record", { syncSequence: ["failed"] }, [
        {
          op: "start",
          options: { accountId: ACCOUNT, country: "DE", language: "en" },
        },
        { op: "rejectAll" },
      ]),
    ];
    emit(
      "fixtures/engine.json",
      fixture({
        description:
          "End-to-end engine scenarios against a fake platform. See spec/mobile/README.md#engine-scenarios for the operations, the fake server and how to compare each step.",
        now: new Date(T0).toISOString(),
        platform: "ios",
        cases: scenarios,
      }),
    );
  });

  it("text", () => {
    const cases: [
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ][] = [
      ["English", "main", { region: "DE", locale: "en" }, { locale: "en-GB" }],
      ["German", "main", { region: "DE", locale: "de" }, { locale: "de-DE" }],
      [
        "German copy with SDK fallbacks",
        "variant",
        { region: "DE", locale: "de" },
        { locale: "de-AT" },
      ],
      [
        "Arabic, right to left",
        "variant",
        { region: "DE", locale: "ar" },
        { locale: "ar-EG" },
      ],
      [
        "Brazilian Portuguese device on English copy",
        "main",
        { region: "US", locale: "pt" },
        { locale: "pt-BR" },
      ],
      [
        "app translations",
        "variant",
        { region: "DE", locale: "ar" },
        {
          locale: "ar",
          translations: {
            ar: { ui: { title: "مخصص", save: " " } },
            "ar-EG": { ui: { close: "x" } },
          },
        },
      ],
    ];
    emit(
      "fixtures/text.json",
      fixture({
        description:
          "consentText: dashboard copy with SDK fallbacks. `dashboard` adapts `bundle` with `adapt`; `options` are the locale and app translations. `messages` is summarized as its language and resolved ui copy.",
        cases: cases.map(([name, bundle, adapt, options]) => {
          const dashboard = adaptPlatformConfig(
            bundles[bundle],
            adapt,
          ) as DashboardConfig;
          const { messages: sdk, ...text } = consentText(
            dashboard,
            options as Parameters<typeof consentText>[1],
          );
          return {
            name,
            bundle,
            adapt,
            options,
            expected: {
              ...text,
              messages: { language: sdk.language ?? null, ui: sdk.ui },
            },
          };
        }),
      }),
    );
  });

  it("i18n", () => {
    const tags = [
      "de",
      "de-AT",
      "DE_at",
      "pt",
      "pt-BR",
      "pt-br",
      "pt-PT",
      "zh-Hant",
      "nb",
      "nn-NO",
      "no",
      "en-US",
      "xx",
      "",
      " fr ",
      "he-IL",
    ];
    emit(
      "fixtures/i18n.json",
      fixture({
        description:
          "SDK copy lookup. `sdkLanguage` resolves a tag to a built-in locale (null when none matches). `messages` cases resolve every ui key and some data and purpose labels with app translations.",
        languages: SDK_LANGUAGES,
        sdkLanguage: tags.map((tag) => ({
          tag,
          expected: sdkLanguage(tag) ?? null,
        })),
        cases: (
          [
            { tag: "de-CH", translations: {} },
            { tag: "fr", translations: { fr: { ui: { title: "Mon titre" } } } },
            {
              tag: "pt-BR",
              translations: {
                pt: { ui: { save: "Guardar" }, data: { device_id: "ID" } },
                "pt-BR": { ui: { title: "  " } },
              },
            },
            { tag: "xx", translations: { xx: { ui: { close: "X" } } } },
            { tag: undefined, translations: {} },
          ] as { tag: string | undefined; translations: Translations }[]
        ).map(({ tag, translations }) => {
          const result = messages(tag, translations);
          const keys = [
            "device_id",
            "crash_data",
            "made_up_key",
            "other-thing",
          ];
          const purposes = ["analytics", "made_up_purpose"];
          return {
            tag: tag ?? null,
            translations,
            expected: {
              language: result.language ?? null,
              ui: result.ui,
              has: Object.fromEntries(
                Object.keys(en.ui).map((key) => [
                  key,
                  result.has(key as keyof typeof en.ui),
                ]),
              ),
              dataType: Object.fromEntries(
                keys.map((key) => [key, result.dataType(key)]),
              ),
              purpose: Object.fromEntries(
                purposes.map((key) => [key, result.purpose(key)]),
              ),
            },
          };
        }),
      }),
    );
  });

  it("presentation", () => {
    const html = [
      "Plain text",
      "<p>One</p><p>Two <b>bold</b> and <i>italic</i></p>",
      "Read our <a href='https://example.test/privacy'>privacy policy</a>.",
      "<a href=\"javascript:alert(1)\">bad link</a> <a href='http://ok.test/x?y=1#z'>ok</a>",
      "<ul><li>First</li><li>Second <strong>item</strong></li></ul>",
      "Line<br>break<br/>again",
      "&amp; &lt;tag&gt; &quot;q&quot; &#39;s&#39; &#x1F36A; &nbsp;x &bogus; &#0; &#xD800;",
      "  lots   of\n\n spaces  ",
      "<div><em>nested <b>both</b></em></div><h2>Heading</h2>",
      "<script>alert(1)</script>after",
      "",
      "<b>unclosed bold",
      "</b>stray close",
    ];
    const urls = [
      "https://example.test",
      "http://example.test/path?x=1#y",
      "  https://example.test/trim  ",
      "https://user:pass@example.test",
      "javascript:alert(1)",
      "ftp://example.test",
      "https://",
      "https://exa mple.test",
      `https://example.test/${"a".repeat(2050)}`,
      "HTTPS://EXAMPLE.TEST",
    ];
    const themes: [string, Record<string, unknown>, string | null][] = [
      ["default light", {}, null],
      ["dark mode on", { dark_mode: true }, "light"],
      ["dark mode string", { dark_mode: "dark" }, null],
      ["auto in dark", { dark_mode: "auto" }, "dark"],
      ["auto in light", { dark_mode: "auto" }, "light"],
      ["main bundle theme", MAIN.banners.bnrUS1.theme, "light"],
      ["variant theme light", VARIANT.banners.bnrDE.theme, "light"],
      ["variant theme dark", VARIANT.banners.bnrDE.theme, "dark"],
      [
        "radii and invalid colors",
        {
          modal_border_radius: "12",
          btn_border_radius: "0.25em",
          colors: {
            bg: "rgb(1, 2, 3)",
            text_color: "#abc",
            link_color: "url(x)",
          },
          logo_url_light: "https://example.test/l.png",
        },
        "light",
      ],
      [
        "dark logo falls back to light",
        { dark_mode: "dark", logo_url_light: "https://example.test/l.png" },
        null,
      ],
    ];
    const gui = [
      {},
      { layout: "cloud", position: "top left", button_placement: "inline" },
      { layout: "bar", position: "middle center" },
      { layout: "bar", position: "top", button_placement: "inline wide" },
      { layout: "box", position: "middle_right", button_placement: "wide" },
      { layout: "fullscreen", position: "bottom left" },
      { layout: "popup", position: "left" },
    ];
    const appDataInputs = [
      undefined,
      null,
      {},
      VARIANT.categories[3].services[0].app_data,
      { tracking: true },
      { collected: ["x".repeat(129), "ok"], retention: "   " },
      { packages: { ios: ["a"], android: "b" } },
      [1, 2],
    ];
    emit(
      "fixtures/presentation.json",
      fixture({
        description:
          "Pure helpers the consent screens use. `rich` returns paragraphs of spans; absent span flags are absent. `palette` takes a dashboard theme and the system color scheme.",
        cases: [],
        plain: html.map((value) => ({ value, expected: plain(value) })),
        rich: html.map((value) => ({ value, expected: rich(value) })),
        url: urls.map((value) => ({ value, expected: url(value) ?? null })),
        withoutBranding: [
          VARIANT.banners.bnrDE.footer.content,
          "<a href='https://www.cookiechimp.com/?ref=x'>Powered</a> rest",
          "<a href='https://cookiechimp.com/pricing'>Pricing</a>",
        ].map((value) => ({ value, expected: withoutBranding(value) })),
        poweredBy: [
          { banner: { footer: { show_powered_by: true } } },
          { banner: { footer: { show_powered_by: "true" } } },
          { banner: {} },
        ].map(({ banner }) => ({ banner, expected: poweredBy(banner) })),
        alpha: [
          ["#333", 0.16],
          ["#2B2B2B", 0.5],
          ["red", 0.3],
          ["rgba(1,2,3,0.4)", 0.2],
          ["#12345678", 0.1],
        ].map(([color, opacity]) => ({
          color,
          opacity,
          expected: alpha(color as string, opacity as number),
        })),
        radius: [
          ["8px", 6.4],
          ["0.5rem", 6.4],
          ["1em", 6.4],
          [12, 6.4],
          ["12", 6.4],
          ["-1px", 6.4],
          ["5000px", 6.4],
          ["big", 6.4],
          [null, 8],
        ].map(([value, fallback]) => ({
          value,
          fallback,
          expected: radius(value, fallback as number),
        })),
        palette: themes.map(([name, theme, scheme]) => ({
          name,
          theme,
          scheme,
          expected: palette(theme, scheme),
        })),
        bannerDisplay: gui.map((value) => ({
          gui: value,
          expected: bannerDisplay(value),
        })),
        appData: appDataInputs.map((value) => ({
          value: value ?? null,
          expected: appData(value) ?? null,
        })),
        label: ["device_id", "made_up-key", "x"].map((key) => ({
          key,
          expected: label(en.data, key),
        })),
      }),
    );
  });

  it("region", () => {
    const inputs: unknown[] = [
      "DE",
      "de",
      " us-ca ",
      "US-CA-X",
      "XX",
      "USA",
      "U",
      "GB-ENG",
      "US-",
      "",
      null,
      { country: "us", region: "US-ny" },
      { country: "CA", region: "QC" },
      { country: "FR", region: "toolong" },
      { country: "1A" },
    ];
    emit(
      "fixtures/region.json",
      fixture({
        description:
          "parseRegion for the `country` option and the geolocation response, and the country_banner_map key for the result.",
        cases: inputs.map((value) => {
          const region = parseRegion(value as string);
          return { value, expected: region, key: regionKey(region) };
        }),
      }),
    );
  });

  it("records", () => {
    deterministic();
    const dashboard = adaptPlatformConfig(MAIN, {
      region: "DE",
      locale: "en",
    }) as DashboardConfig;
    const runtime = createConsent({
      categories: dashboard.categories,
      services: dashboard.services,
      regulation: "gdpr",
      promptOnOptOut: true,
      region: { country: "DE" },
      gpc: false,
      storage: { getItem: () => null, setItem: () => {} },
    });
    const states = [
      runtime.acceptAll(),
      runtime.rejectAll(),
      runtime.set({
        categories: { analytics: true },
        services: { "microsoft-clarity": false },
      }),
    ];
    const serviceCategories = Object.fromEntries(
      dashboard.services.map(({ id, category }) => [id, category]),
    );
    emit(
      "fixtures/records.json",
      fixture({
        description:
          "The callback summary (toUserPreferences) and the platform record (toPlatformConsent) for consent states. Services missing from the dashboard group under `other` in records. The native url is always empty, like React Native.",
        dashboard: { bundle: "main", region: "DE", locale: "en" },
        cases: [
          ...states,
          {
            ...states[0],
            services: { "google-analytics": true, retired: false },
            regulation: undefined,
          } as ConsentState,
        ].map((state) => ({
          state,
          userPreferences: toUserPreferences(state, dashboard),
          record: toPlatformConsent(state, {
            url: "",
            bannerId: dashboard.bannerId,
            language: "en",
            serviceCategories,
            platform: "ios",
          }),
        })),
      }),
    );
  });

  it("integrations", () => {
    const categories: Record<string, boolean>[] = [
      {},
      { analytics: true },
      { marketing: true },
      { advertising: true, analytics: false },
      { analytics: true, marketing: true },
    ];
    emit(
      "fixtures/integrations.json",
      fixture({
        description:
          "Firebase Consent Mode v2 signals for category decisions (default mapping, and a custom one), App Tracking Transparency status normalization, and service ids for vendor names.",
        defaultMapping: DEFAULT_CONSENT_MAPPING,
        cases: [],
        firebase: [
          ...categories.map((value) => ({
            categories: value,
            mapping: null,
            expected: firebaseConsent(value),
          })),
          {
            categories: { stats: true, ads: false },
            mapping: { stats: ["analytics_storage", "ad_user_data"] },
            expected: firebaseConsent(
              { stats: true, ads: false },
              { stats: ["analytics_storage", "ad_user_data"] },
            ),
          },
        ],
        tracking: [
          "authorized",
          "granted",
          "denied",
          "restricted",
          "not-determined",
          "undetermined",
          "other",
          3,
          { status: "granted" },
        ].map((value) => ({ value, expected: trackingStatus(value) })),
        serviceId: [
          "Google Analytics",
          "Firebase Crashlytics",
          "Facebook SDK",
          "  ÜBER--Tracker  ",
          "a".repeat(80),
          "AppsFlyer",
        ].map((name) => ({ name, expected: serviceId(name) })),
      }),
    );
  });

  it("locales", () => {
    const locales = [...SDK_LANGUAGES].sort();
    for (const code of locales) {
      const locale = messages(code);
      // Built-in copy only: what the locale file itself provides.
      const own = {
        ui: Object.fromEntries(
          Object.keys(en.ui)
            .filter((key) => locale.has(key as keyof typeof en.ui))
            .map((key) => [key, locale.ui[key as keyof typeof en.ui]]),
        ),
        data: Object.fromEntries(
          Object.keys(en.data).map((key) => [key, locale.dataType(key)]),
        ),
        purposes: Object.fromEntries(
          Object.keys(en.purposes).map((key) => [key, locale.purpose(key)]),
        ),
      };
      emit(`locales/${code}.json`, own);
    }
    emit("locales/index.json", {
      specVersion: SPEC_VERSION,
      languages: locales,
      aliases: { nb: "no", nn: "no" },
      uiKeys: Object.keys(en.ui),
      dataTypes: Object.keys(en.data),
      purposes: Object.keys(en.purposes),
    });
  });

  afterAll(() => {
    emit("manifest.json", {
      specVersion: SPEC_VERSION,
      reactNative: packageJson.version,
      core: CORE_VERSION,
      files: [...written].filter((path) => path !== "manifest.json").sort(),
    });
    // Remove fixtures this generator no longer writes.
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? files(join(dir, entry.name))
          : entry.name.endsWith(".json")
            ? [relative(SPEC, join(dir, entry.name))]
            : [],
      );
    for (const path of existsSync(SPEC) ? files(SPEC) : [])
      if (!written.has(path)) {
        if (UPDATE) rmSync(join(SPEC, path));
        else throw new Error(`spec/mobile/${path} is no longer generated.`);
      }
  });
});

/**
 * Replace pass-through values copied unchanged from the bundle with
 * `{ "$ref": "path.in.bundle" }`. Native tests resolve them against the input.
 */
function compact(config: DashboardConfig | undefined, input: unknown) {
  if (!config) return null;
  const bundle = input as Record<string, Json>;
  const refs: [keyof DashboardConfig, string[]][] = [
    ["banner", ["banners", config.bannerId]],
    ["theme", ["banners", config.bannerId, "theme"]],
    ["translations", ["translations", config.bannerId]],
    ["copy", ["translations", config.bannerId, config.language]],
    ["regions", ["country_banner_map"]],
    ["integrations", ["integrations"]],
    ["cookie", ["cookie_settings"]],
  ];
  const result: Record<string, unknown> = { ...config };
  for (const [key, path] of refs) {
    const value = path.reduce<Json>((at, part) => at?.[part], bundle);
    if (value !== undefined && isDeepStrictEqual(value, config[key]))
      result[key] = { $ref: path.join(".") };
  }
  return result;
}

/** A stored config body that is one of the fixture bundles, by name. */
function bundleRef(value: unknown) {
  const name = Object.keys(bundles).find((key) =>
    isDeepStrictEqual(bundles[key], value),
  );
  return name ? { $bundle: name } : value;
}

function nextIdPreview(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

type Op =
  | { op: "start"; options: Record<string, unknown> }
  | { op: "restart" }
  | { op: "advance"; ms: number }
  | { op: "foreground" }
  | { op: "flush" }
  | { op: "acceptAll" | "rejectAll" | "reset" }
  | {
      op: "save";
      categories: Record<string, boolean>;
      services: Record<string, boolean>;
    }
  | { op: "acceptCategory"; value: "all" | string[] }
  | { op: "acceptService"; value: "all" | string[]; category: string }
  | {
      op: "showBanner" | "hideBanner" | "showPreferences" | "hidePreferences";
    };

interface Server {
  geo?: unknown;
  configStatus?: number;
  configSequence?: string[];
  syncSequence?: (number | "failed")[];
}

/** Settle the engine's pending promises; timers stay real and unfired. */
async function settle() {
  for (let index = 0; index < 25; index++)
    await new Promise((done) => setTimeout(done, 0));
}

const parse = (value: string) => {
  if (value.startsWith("v1.")) return { consent: decodeConsentCookie(value) };
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

async function scenario(name: string, server: Server, ops: Op[]) {
  resetCookieChimp();
  clearVendors();
  deterministic();
  const data = new Map<string, string>();
  const storage: AsyncKeyValueStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
  let requests: Record<string, unknown>[] = [];
  let callbacks: Record<string, unknown>[] = [];
  let configCalls = 0;
  let syncCalls = 0;
  const api = "https://cookiechimp.com/api/v1/mobile-sdk";
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const request: Record<string, unknown> = {
      method: init?.method ?? "GET",
      url,
    };
    const etag = headers.get("If-None-Match");
    if (etag) request.ifNoneMatch = etag;
    if (init?.body) {
      request.contentType = headers.get("Content-Type");
      request.body = JSON.parse(String(init.body));
    }
    requests.push(request);
    if (url.startsWith(`${api}/geolocation/`)) {
      if (typeof server.geo === "number")
        return new Response("{}", { status: server.geo });
      return Response.json(server.geo ?? { country: "DE", region: null });
    }
    if (url.startsWith(`${api}/offline/`)) {
      if (server.configStatus)
        return new Response("{}", { status: server.configStatus });
      const sequence = server.configSequence ?? ["main"];
      const bundle = bundles[
        sequence[Math.min(configCalls++, sequence.length - 1)] as string
      ] as { cache_version: string };
      if (etag === `"${bundle.cache_version}"`)
        return new Response(null, { status: 304 });
      return Response.json(bundle, {
        headers: { ETag: `"${bundle.cache_version}"` },
      });
    }
    if (url.startsWith(`${api}/sync/`)) {
      const { consents } = JSON.parse(String(init?.body)) as {
        consents: { client_id: string }[];
      };
      const sequence = server.syncSequence ?? [200];
      const outcome = sequence[Math.min(syncCalls++, sequence.length - 1)];
      if (outcome === "failed")
        return Response.json({
          synced: [],
          failed: consents.map(({ client_id }) => ({
            client_id,
            errors: ["Uuid is invalid"],
          })),
        });
      if (outcome !== 200) return new Response("{}", { status: outcome });
      return Response.json({
        synced: consents.map(({ client_id }) => ({ client_id })),
        failed: [],
      });
    }
    return new Response("not found", { status: 404 });
  };
  let options: Record<string, unknown> = {};
  const start = () =>
    CookieChimp.run({
      ...options,
      ...(typeof options.config === "string"
        ? { config: bundles[options.config] }
        : {}),
      storage,
      fetch: fetch as typeof globalThis.fetch,
      onAccept: (preferences) =>
        callbacks.push({ name: "onAccept", preferences }),
      onFirstConsent: (preferences) =>
        callbacks.push({ name: "onFirstConsent", preferences }),
      onChange: (preferences, categories, services) =>
        callbacks.push({
          name: "onChange",
          preferences,
          changedCategories: categories,
          changedServices: services,
        }),
    });
  const steps = [];
  for (const step of ops) {
    switch (step.op) {
      case "start":
        options = step.options;
        await start();
        break;
      case "restart":
        await store.engine()?.settled();
        await start();
        break;
      case "advance":
        vi.setSystemTime(Date.now() + step.ms);
        break;
      case "foreground":
        emitAppState("active");
        break;
      case "flush":
        await CookieChimp.flush();
        break;
      case "acceptAll":
        CookieChimp.acceptCategory("all");
        break;
      case "rejectAll":
        CookieChimp.acceptCategory([]);
        break;
      case "reset":
        CookieChimp.reset();
        break;
      case "save":
        store.engine()?.save(step);
        break;
      case "acceptCategory":
        CookieChimp.acceptCategory(step.value);
        break;
      case "acceptService":
        CookieChimp.acceptService(step.value, step.category);
        break;
      case "showBanner":
        CookieChimp.show();
        break;
      case "hideBanner":
        CookieChimp.hide();
        break;
      case "showPreferences":
        CookieChimp.showPreferences();
        break;
      case "hidePreferences":
        CookieChimp.hidePreferences();
        break;
    }
    await settle();
    await store.engine()?.settled();
    const snapshot = store.getSnapshot();
    const keys = [...data.keys()].sort();
    steps.push({
      ...step,
      ...(step.op === "start" && typeof step.options.config === "string"
        ? {
            options: {
              ...step.options,
              config: `bundle:${step.options.config}`,
            },
          }
        : {}),
      snapshot: {
        status: snapshot.status,
        error: snapshot.error ?? null,
        decided: snapshot.decided,
        bannerOpen: snapshot.bannerOpen,
        preferencesOpen: snapshot.preferencesOpen,
        source: snapshot.source,
        region: snapshot.region,
        regulation: snapshot.regulation,
        language: snapshot.language,
        locale: snapshot.locale,
        bannerId: snapshot.dashboard?.bannerId ?? null,
        configVersion: snapshot.dashboard?.configVersion ?? null,
        consent: snapshot.consent,
        pending: store.engine()?.pending() ?? 0,
        acceptedCategories: Object.fromEntries(
          ["necessary", "essential", "analytics", "marketing", "unknown"].map(
            (id) => [id, CookieChimp.acceptedCategory(id)],
          ),
        ),
        acceptedServices: Object.fromEntries(
          [
            ["Google Analytics", undefined],
            ["google-analytics", undefined],
            ["Meta Pixel", "marketing"],
            ["Unknown SDK", "analytics"],
            ["Unknown SDK", undefined],
          ].map(([service, category]) => [
            `${service}${category ? ` (${category})` : ""}`,
            CookieChimp.acceptedService(service as string, category),
          ]),
        ),
        userPreferences: CookieChimp.getUserPreferences(),
      },
      requests,
      callbacks,
      storage: Object.fromEntries(
        keys.map((key) => [
          key.slice(STORAGE_PREFIX.length),
          bundleRef(parse(data.get(key) as string)),
        ]),
      ),
    });
    requests = [];
    callbacks = [];
  }
  resetCookieChimp();
  return { name, server, steps };
}

it("covers every locale with complete copy", () => {
  for (const code of SDK_LANGUAGES)
    for (const key of Object.keys(en.ui))
      expect(
        messages(code).has(key as keyof typeof en.ui),
        `${code}.${key}`,
      ).toBe(true);
});
