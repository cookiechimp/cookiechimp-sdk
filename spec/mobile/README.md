# Native mobile SDK specification

This folder defines how the native CookieChimp SDKs for iOS (Swift) and
Android (Kotlin) must behave. The React Native SDK in
`packages/react-native` is the reference implementation. Everything under
`fixtures/` and `locales/` is generated from it, so the native SDKs stay in
step with the code that ships on npm.

- Check: `pnpm test:unit` fails when a fixture no longer matches the code.
- Update: `pnpm spec:mobile`, then review and commit the changed JSON.
- Native repos copy this folder at a pinned commit or release
  (`cookiechimp-mobile-spec-<tag>.zip` on each GitHub release) and run every
  fixture in their own unit tests. `manifest.json` lists the files and the
  package versions they came from.

The generator is `packages/react-native/src/conformance.test.ts`. Change the
TypeScript first, regenerate, then port the change to both native SDKs.

## Scope

| Area | Rule | Fixtures |
|---|---|---|
| Consent value | `v1.` plus unpadded base64url of UTF-8 JSON, at most 3800 characters | `codec.json` |
| Config | Offline bundle to DashboardConfig, banner and language choice | `adapt.json`, `bundles/` |
| Consent runtime | Defaults, accept, reject, custom choices, restore, expiry | `consent.json` |
| Engine | Fetch, cache, revalidation, re-consent, records, callbacks | `engine.json` |
| Copy | Dashboard copy with SDK fallbacks, 33 built-in locales | `text.json`, `i18n.json`, `locales/` |
| Presentation | Rich text, links, theme colors, radii, banner layout, data labels | `presentation.json` |
| Region | `country` option and geolocation parsing | `region.json` |
| Records | Callback summary and platform record | `records.json` |
| Integrations | Firebase Consent Mode, ATT status, vendor service ids | `integrations.json` |

TCF and GPP are not part of the mobile SDKs yet.

## Network

All requests go to `apiBase` (default `https://cookiechimp.com`, https only,
no credentials, query or fragment). No cookies are sent and redirects are
refused.

- Config: `GET {apiBase}/api/v1/mobile-sdk/offline/{accountId}`. Send
  `If-None-Match` with the cached `etag` (`"<cache_version>"`). Abort after
  5 seconds. Reject bodies over 524288 characters. A 304 keeps the cached
  config. Any other non-2xx response is an `HTTP <status>` error.
- Geolocation (opt-in only, never by default): `GET
  {apiBase}/api/v1/mobile-sdk/geolocation/{accountId}`. Abort after 3
  seconds, reject bodies over 4096 characters, and treat every failure as no
  region. Device location permissions and third-party services are never used.
- Records: `POST {apiBase}/api/v1/mobile-sdk/sync/{accountId}` with
  `Content-Type: application/json` and body `{"consents":[...]}`. Abort after
  10 seconds.

`accountId` must match `^[\w-]{1,64}$`.

## Config

Parse JSON while dropping `__proto__`, `constructor` and `prototype` keys at
every depth, then adapt it as `adapt.json` shows:

- Reject when `schema_version` is present and not 1, `cache_version` is
  missing or over 128 characters, `account_hashid` is missing or over 64, or
  `account_hashid` differs from the requested account.
- Banner: `country_banner_map[REGION]` (for example `US-CA`), then
  `country_banner_map[COUNTRY]`, then `default_banner`. The first id that is a
  string of at most 64 characters with an object in `banners` wins.
- Language: the base of the locale (`de` for `de-AT`), then each of the
  banner's `available_languages`, then the banner's translation keys in order.
  The first one with an object in `translations[banner]` wins. Otherwise the
  language is the empty string.
- Category and service ids are slugs: lower case, every run of characters
  outside `[a-z0-9_-]` becomes `-`, leading and trailing `-` trimmed, at most
  64 characters. Empty slugs are skipped. A service whose slug was already
  used (in any category) is skipped.
- Translatable fields read `item.translations[language][key]`, then
  `item[key]`. Text fields have length limits; longer values are absent.
- Categories are opt-out defaults (`default: true`) only when the banner's
  `consent_mode` is `opt-out` (normalized to `opt_out`).

Cache the sanitized JSON under `cc_config:{accountId}:{cache_version}` and
point `cc_config:{accountId}` at the version. Remove the previous version's
body after a successful write. A cached body whose version does not match the
pointer is ignored. The cache is re-adapted with the current locale and
region on every launch.

## Consent

The consent runtime follows core `createConsent` with these mobile options:

- `regulation` is `ccpa` when a region is known and `consentMode` is
  `opt_out`; otherwise `gdpr`.
- `promptOnOptOut` is true: the banner shows until the user decides, under
  both regulations.
- GPC is always false on mobile.
- `necessary` is always present, first and required. Required categories are
  always true, in every state, record and stored value. Their services are
  always true.
- Initial category values: required true; GDPR false; CCPA true.
- Accept all: every category and every known service true. Reject all: only
  required categories and their services true. Custom: known categories and
  services only, non-boolean values ignored, previous choices kept.
- A service without an explicit choice follows its category in the public
  state. Unknown stored services stay in storage but not in the public state.
- A stored decision is used only while `ts + maxAge` is in the future, when
  it decodes, and when its regulation is absent or equal to the current one.
  Unknown stored categories are kept.

The engine stores the encoded value under the cookie name: `cookie_settings.name`
when it matches ``^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$``, otherwise `cc_consent`.
`maxAge` is `banner.expires_days ?? banner.consent_duration_days ??
cookie_settings.expires_days` days when that is an integer from 1 to 730,
otherwise 180 days.

Consent ids are random UUID v4 strings in lower case. Timestamps are ISO 8601
UTC with milliseconds, for example `2026-10-15T09:30:02.000Z`. Decoders accept
ISO 8601 dates and date-times with `Z` or an offset, with or without
fractional seconds.

## Engine

The engine is the SDK's main object. It follows `createEngine` in
`packages/react-native/src/engine.ts`:

1. Read storage. Resolve the region: the `country` option, else the
   geolocation endpoint when `geolocation` is true and an account is set,
   else none.
2. Config: the bundled `config` when given (source `bundle`, no config
   requests), else the cache (source `cache`, then revalidate in the
   background), else the network (source `network`). Without either,
   fail with `accountId or config is required`.
3. Apply: work out the cookie name and maxAge, remove a stored decision made
   before `reconsent_required_at`, create the consent runtime and the record
   queue, and open the banner when no valid decision exists.
4. On every foreground: rebuild the runtime when the stored decision expired,
   retry queued records, and revalidate the config when the last attempt was
   over 5 minutes ago or no config has loaded yet. A new `cache_version`
   applies the new config.

Callbacks: `onFirstConsent` after a decision made while no valid decision
existed, `onChange` after a later decision that changed categories or services
(sorted ids of what changed), and `onAccept` after every decision and on
launch when a valid decision is stored.

### Consent records

Each decision becomes one record (`records.json`). `client_id` is
`consentId:ts`; a record whose `client_id` was already queued is dropped.
`url` is the empty string. `language_code` is the dashboard language and
`consent_banner_hashid` the banner id. Services are grouped by category,
`other` when unknown.

The queue is stored under `cc_consent_queue:{accountId}` as a JSON array of
`{"record": ..., "attempts": n, "next": ms}` and removed when empty. It keeps
the newest 50 records and drops records older than 30 days. After a failed
POST each sent record waits `min(300000, 2000 * 2^(attempts-1))` ms times
`0.5 + random/2` (rounded up). A 2xx response removes the records listed in
`synced`, and those in `failed` unless their `errors` include `Batch limit
exceeded`; a 2xx without a readable list removes everything sent. Retry
clears every wait and sends the whole queue.

### Engine scenarios

`engine.json` drives the engine against a fake platform with fixed time
(`now`), consent ids `00000000-0000-4000-8000-000000000001`, `...002` and so
on, and `random` fixed at 0.5. Native harnesses run each case from empty
storage and, after every step, let pending work finish before comparing.

Operations: `start` (options; `config: "bundle:<name>"` is a bundle file),
`restart` (destroy the engine and start again with the same options and
storage, like an app relaunch), `advance` (move the clock), `foreground`,
`flush` (send queued records now), `acceptAll`, `rejectAll`, `save`,
`acceptCategory` (`"all"`, `[]` or ids), `acceptService` (`"all"` or names,
in a category), `reset`, `showBanner`, `hideBanner`, `showPreferences` and
`hidePreferences`.

The fake server (`server`): geolocation returns `geo` (a number is an error
status; the default is Germany). Config returns the bundles in
`configSequence` in order (default `main`), 304 when `If-None-Match` matches,
or `configStatus` when set. Sync answers each POST from `syncSequence`
(default 200 with every record synced; `failed` reports every record as
failed validation).

Each step lists the requests made during it (`ifNoneMatch`, `contentType` and
the parsed `body` when present), the callbacks fired, the snapshot after it,
and the full storage. Storage keys are the SDK's own keys; native SDKs may add
a prefix or namespace. Values are parsed JSON, `{"consent": state}` for the
consent value, and `{"$bundle": name}` for a cached config body. `platform`
in records is `ios` in the fixture; Android expects `android`.

## Copy

`consentText` (`text.json`) resolves every string from the dashboard copy in
the selected language, then the SDK's own copy in that language, then the
dashboard copy in the banner's first available language, then English.
Optional copy (additional description, more info, footer) only comes from the
selected language. A device locale with the same base language (`pt-BR` on
`pt` copy) selects the regional SDK locale.

The 33 locale files hold the SDK's interface copy and the app store data label
names. `nb` and `nn` use `no`. Lookup order for each key: the app's
translations for the exact tag, then its base language, then the built-in
locale, then English. Unknown data and purpose keys become readable text
(`made_up_key` is `Made up key`). `poweredBy` contains `{name}` where the
CookieChimp name goes.

## Consent screens

Native screens follow the React Native screens in
`packages/react-native/src/ui`:

- Banner layouts `box`, `cloud`, `bar` and `fullscreen` with positions and
  button placements from `bannerDisplay` (`presentation.json`). Accept,
  reject and preferences buttons follow `buttons.show_*`, `equal_weight_buttons`
  (reject is primary when true or absent) and `swap_buttons` (reverses the
  order). The close button shows only when `show_close_btn` is true and
  `force_consent` is not. `force_consent` dims the app behind the banner and
  blocks dismissal.
- Preferences: modal, side panel (`preferences_gui_options.layout` is `bar`,
  side from `position`, mirrored for right-to-left) or full screen (when the
  banner is full screen). Category switches, vendor switches unless
  `control_level` is `category_only`, vendor details unless services are
  hidden, storage items, app store data labels (`app_data`), the consent id
  and the save, accept and reject buttons from `preferences_buttons`.
- Switching a category switches all of its services. A category is on while
  any of its services is on. Required categories cannot be switched. Each
  opening starts from the saved decision.
- Colors, radii and logo come from `palette`. Links open only http and https
  URLs without credentials.
- "Powered by CookieChimp" shows in the banner when `footer.show_powered_by`
  is true (Free and Basic plans) and always in the preferences. Footer copy
  linking to cookiechimp.com is removed because the SDK draws the line itself.
- Respect reduced motion, dynamic type, screen readers and right-to-left
  languages (`rtlLanguages`, else `ar fa he ur`).

## Integrations

- Vendors register by dashboard service name and category. A vendor runs
  while its service is allowed (or its category when the service is unknown)
  and nothing runs before consent is loaded. A new vendor is neither started
  nor stopped: the first evaluation that does not allow it calls its stop
  callback once, because vendor SDKs keep their last setting across launches.
- Firebase: Analytics, Crashlytics and Performance collection follow their
  services, and Analytics receives Consent Mode v2 signals on launch and after
  every decision (`integrations.json`).
- App Tracking Transparency is requested only after the user allowed the
  `marketing` category (or a chosen service), only while the app is active,
  at most once per launch.
- WebView bridge (native only): write the encoded consent value as a
  first-party cookie named after the cookie name, so the CookieChimp web
  banner on that site reads the app's decision instead of asking again.
