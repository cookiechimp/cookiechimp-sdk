# Platform JSON presentation compatibility

The React `@cookiechimp/react/platform` entry consumes the platform's offline
bundle directly. Its GUI and theme values follow `MobileSdk::BuilderHelpers`,
`ConsentBanners::ConsentModal`, `ConsentBanners::PreferencesModal`,
`ConsentBanners::Theme` and the Banner Designer's layout previews. No second
category/vendor schema is required. These sources were compared with platform
`main` on 18 October 2026; the platform repository was read only.

| JSON fields | SDK behavior |
| --- | --- |
| `gui_options.layout` | `box`, `cloud`, `bar` |
| `gui_options.position` | All nine top/middle/bottom and left/center/right combinations; bars use top or bottom, spanning the viewport. Space-separated platform values and legacy underscores are accepted. |
| `gui_options.button_placement` | Box: stacked, inline, wide. Cloud: stacked, inline. Bar: inline, wide. Inline places accept/reject side by side and preferences across the row; wide puts actions in one row and widens the box. Both `wide` and legacy `inline wide` are accepted. |
| `gui_options.swap_buttons` | Reverses banner action order in the DOM so keyboard order follows the visual order. |
| `gui_options.equal_weight_buttons` | Accept and reject share primary colors when enabled; preferences remains secondary. Accept stays primary when equal weight is disabled. |
| `buttons` | Independent accept, reject, preferences and close visibility. Close dismisses without recording consent. |
| `preferences_gui_options.layout`, `position` | Centered box or full-height left/right side panel; responsive at narrow widths. |
| `preferences_gui_options.equal_weight_buttons` | Same accept/reject color behavior as the banner. |
| `preferences_gui_options.control_level`, `show_services` | Category/vendor controls or category-only consent, with optional read-only service disclosures. |
| `preferences_gui_options.show_floating_icon`, `floating_icon_position` | Hide/show the recall control at bottom left or bottom right. |
| `preferences_buttons` | Independent accept, reject and save visibility. |
| `theme.dark_mode` | `auto`, `light`, `dark`; auto follows system changes through CSS. Legacy booleans remain supported. |
| `theme.colors`, `theme.dark_colors` | All eight background, heading, text, link and primary/secondary button colors, scoped to the consent UI. |
| `theme.modal_border_radius`, `theme.btn_border_radius` | Valid platform CSS values in px, em, rem or percent, including zero; legacy numeric pixel radii remain supported. Side panels and full-width bars retain square viewport edges. |
| `theme.logo_url_light`, `theme.logo_url_dark` | Valid HTTP(S) logos, with light/dark switching and a fallback when only one is present. |
| `translations` | Localized titles, descriptions, additional description, button labels, custom footer links, more-information copy, privacy URL and category/vendor/storage metadata. |
| Rich-text descriptions and footer | Paragraphs, line breaks, emphasis, lists, quotes and safe links become React elements. Executable elements, arbitrary attributes and unsafe URLs are discarded; no raw HTML reaches the DOM. |
| `footer.enabled`, `content`, `show_powered_by` | Custom banner footer content follows its flag. Powered-by branding appears only below preferences information, above its action bar, as requested. |
| `force_consent` | Initial notice blocks pointer interaction with the page, locks scrolling, traps focus and prevents Escape dismissal. Configured close/action buttons retain their configured behavior. |
| `language_autodetect`, `available_languages`, `rtl_languages` | Explicit locale wins; otherwise use configured document/browser detection and the available base language. RTL direction, switch movement and close placement are supported. |
| `consent_mode` | Both current `opt-in`/`opt-out` and legacy underscore spellings work. Opt-out defaults remain enabled and the initial notice is shown until a choice is saved. |
| `cookie_settings`, `expires_days`, `consent_duration_days` | Cookie name and expiration; hosts may explicitly override the cookie for isolated demos. |
| `categories[].services[].storage_items` | Original IDs and localized names, purposes, companies, privacy links, storage types and durations; required categories and vendors remain enabled. |

The React/Vite `/platform.html` example has controls that modify these fields on
its copy of the shared JSON and render the actual SDK. It never loads vendor tags
or sends consent logs. Its illustrative vendors are not a live-site inventory.

## Runtime integrations and metadata

Presentation is one part of the SDK. `enable_tcf` does not turn this category UI
into an IAB TCF CMP: use the explicit TCF provider, vendor data, stub and UI from
the SDK's TCF entry points. Google Consent Mode, GPP, script/iframe gating and
consent delivery likewise use their existing explicit SDK integrations. Reading
an `enabled` flag in dashboard JSON does not install those integrations or load
third-party tags. Browser Global Privacy Control remains enforced by the core.

The adapter preserves account/config versions, banner revisions, region mapping,
integration settings and reconsent timestamps. Connected config refresh and
reconsent signaling belong to the sync client; the static JSON provider does not
fetch fresh configuration or send records. Account allowed-domain metadata is
not a replacement for backend authorization.

These boundaries are intentional and must remain explicit when describing support.
The live backend config retrieval and consent-delivery checks remain required
before npm publication. This PR is not a package release or a platform deployment.
