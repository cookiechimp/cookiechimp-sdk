"use client";

import type { ConsentConfig, ConsentState } from "@cookiechimp/core";
import {
  adaptPlatformConfig,
  type DashboardConfig,
  type PlatformCategory,
  type PlatformService,
  type PlatformStorageItem,
} from "@cookiechimp/core/sync";
import { rtlLocales } from "@cookiechimp/translations";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Banner, Preferences } from "./headless";
import {
  ConsentProvider,
  useConsent,
  useHeadlessContext,
  usePreferences,
} from "./index";

import { RecallButton as BaseRecallButton } from "./ui";

const PlatformContext = createContext<DashboardConfig | null>(null);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
// Disclosures are rendered as text, never as executable dashboard HTML.
const plain = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
    : "";
const url = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return !parsed.username &&
      !parsed.password &&
      ["https:", "http:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
};
function usePlatform() {
  const config = useContext(PlatformContext);
  if (!config)
    throw new Error(
      "Platform consent UI needs a PlatformConsentProvider with a platform JSON bundle.",
    );
  return config;
}
function themeStyle(theme: Record<string, unknown>): CSSProperties {
  const colors = object(
    theme.dark_mode === true ? theme.dark_colors : theme.colors,
  );
  const names: Record<string, string> = {
    bg: "bg",
    heading_color: "heading",
    text_color: "text",
    link_color: "link",
    btn_primary_bg: "btn-primary-bg",
    btn_primary_color: "btn-primary-color",
    btn_secondary_bg: "btn-secondary-bg",
    btn_secondary_color: "btn-secondary-color",
  };
  const style: Record<string, string> = {};
  for (const [key, token] of Object.entries(names)) {
    const value = colors[key];
    if (
      typeof value === "string" &&
      /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(value)
    )
      style[`--cc-banner-${token}`] = value;
  }
  for (const [key, token] of [
    ["modal_border_radius", "card"],
    ["btn_border_radius", "button"],
  ] as const) {
    const value = theme[key];
    if (typeof value === "number" && value >= 0 && value <= 40)
      style[`--cc-radius-${token}`] = `${value}px`;
  }
  return style as CSSProperties;
}

export interface PlatformConsentProviderProps {
  /** The unchanged JSON from the platform offline/config endpoint. */
  bundle: unknown;
  region?: string;
  locale?: string;
  children: ReactNode;
  initialState?: ConsentState | null;
  /** Optional host override, for example an isolated demo cookie. */
  cookie?: ConsentConfig["cookie"];
  onConsent?: ConsentConfig["onConsent"];
  /** Animate the styled UI by default. Reduced-motion preferences always win. */
  motion?: boolean;
}
export function PlatformConsentProvider({
  bundle,
  region,
  locale,
  children,
  initialState,
  cookie,
  onConsent,
  motion = true,
}: PlatformConsentProviderProps) {
  const dashboard = useMemo(
    () => adaptPlatformConfig(bundle, { region, locale }),
    [bundle, region, locale],
  );
  if (!dashboard)
    throw new TypeError("Invalid CookieChimp platform JSON configuration.");
  const days = Number(
    dashboard.banner.expires_days ??
      dashboard.banner.consent_duration_days ??
      dashboard.cookie.expires_days,
  );
  const config: ConsentConfig = {
    categories: dashboard.categories,
    services: dashboard.services,
    regulation: dashboard.consentMode === "opt_out" ? "ccpa" : "gdpr",
    language: dashboard.language,
    cookie: {
      ...(typeof dashboard.cookie.name === "string"
        ? { name: dashboard.cookie.name }
        : {}),
      ...(Number.isInteger(days) && days > 0 && days <= 730
        ? { maxAge: days * 86400 }
        : {}),
      ...cookie,
    },
    onConsent,
  };
  return (
    <PlatformContext.Provider value={dashboard}>
      <ConsentProvider
        key={`${dashboard.bannerId}:${dashboard.configVersion}:${dashboard.language}`}
        config={config}
        initialState={initialState}
        language={dashboard.language}
      >
        <div
          data-cc-platform=""
          data-cc-motion={motion ? "on" : "off"}
          lang={dashboard.language || "en"}
          dir={
            rtlLocales.some((locale) => locale === dashboard.language)
              ? "rtl"
              : "ltr"
          }
          style={themeStyle(dashboard.theme)}
          data-cc-recall-position={String(
            object(dashboard.banner.preferences_gui_options)
              .floating_icon_position ?? "bottom_right",
          )}
        >
          {children}
        </div>
      </ConsentProvider>
    </PlatformContext.Provider>
  );
}

export function CookieBanner() {
  const dashboard = usePlatform();
  const copy = object(dashboard.copy.consent_modal);
  const gui = object(dashboard.banner.gui_options);
  const buttons = object(dashboard.banner.buttons);
  const footer = object(dashboard.banner.footer);
  const privacy = url(dashboard.copy.privacy_policy_url);
  const position =
    gui.layout === "bar"
      ? "bottom"
      : String(gui.position ?? "bottom right").includes("left")
        ? "bottom-left"
        : String(gui.position).includes("center")
          ? "center"
          : "bottom-right";
  return (
    <Banner.Root className="cc-banner" data-cc-position={position}>
      <div className="cc-banner__copy">
        <Banner.Title className="cc-title">
          {plain(copy.title) || "Privacy choices"}
        </Banner.Title>
        <Banner.Description className="cc-description">
          {plain(copy.description) || "Choose which cookies may be used."}
        </Banner.Description>
        {footer.enabled !== false && privacy && (
          <div className="cc-platform-footer">
            <a href={privacy} target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
          </div>
        )}
      </div>
      <div className="cc-actions">
        {buttons.show_preferences_btn !== false && (
          <Banner.Customize className="cc-button cc-button--secondary">
            {plain(copy.preferences_btn) || "Customize"}
          </Banner.Customize>
        )}
        {buttons.show_accept_necessary_btn !== false && (
          <Banner.RejectAll className="cc-button cc-button--secondary">
            {plain(copy.reject_btn) || "Reject optional"}
          </Banner.RejectAll>
        )}
        {buttons.show_accept_btn !== false && (
          <Banner.AcceptAll
            className={`cc-button cc-button--${gui.equal_weight_buttons === true ? "secondary" : "primary"}`}
          >
            {plain(copy.accept_btn) || "Accept all"}
          </Banner.AcceptAll>
        )}
        {buttons.show_close_btn === true && (
          <Banner.Close
            className="cc-button cc-button--secondary"
            aria-label={plain(copy.close_btn) || "Close"}
          >
            ×
          </Banner.Close>
        )}
      </div>
    </Banner.Root>
  );
}

function Disclosure({
  name,
  children,
  toggle,
  className = "",
  expandable = true,
}: {
  name: string;
  children?: ReactNode;
  toggle?: ReactNode;
  className?: string;
  expandable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className={`cc-disclosure ${className}`} data-cc-expanded={open}>
      <div className="cc-disclosure__row">
        {expandable ? (
          <button
            type="button"
            className="cc-disclosure__label"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true" className="cc-disclosure__icon">
              +
            </span>
            {name}
          </button>
        ) : (
          <span className="cc-disclosure__label">{name}</span>
        )}
        {toggle}
      </div>
      <div
        id={id}
        aria-hidden={!open}
        className="cc-disclosure__content"
        ref={(node) => {
          // Use the DOM property so inert also works with React 18.
          if (node) node.inert = !open;
        }}
      >
        <div className="cc-disclosure__clip">
          <div className="cc-disclosure__body">{children}</div>
        </div>
      </div>
    </section>
  );
}
function Switch({
  name,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange(): void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={name}
      aria-checked={checked}
      disabled={disabled}
      className="cc-platform-switch"
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function StorageItems({ items }: { items: PlatformStorageItem[] }) {
  if (!items.length) return null;
  return (
    <ul className="cc-storage-items">
      {items.map((item) => (
        <li key={JSON.stringify(item)}>
          <strong>{item.name}</strong>
          {item.description && <p>{plain(item.description)}</p>}
          <dl>
            {item.type && (
              <div>
                <dt>Type</dt>
                <dd>{item.type.replaceAll("_", " ")}</dd>
              </div>
            )}
            {item.duration && (
              <div>
                <dt>Duration</dt>
                <dd>{plain(item.duration)}</dd>
              </div>
            )}
            {item.company && (
              <div>
                <dt>Company</dt>
                <dd>{plain(item.company)}</dd>
              </div>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}
function VendorDetails({ service }: { service: PlatformService }) {
  const privacy = url(service.privacy_policy_url);
  return (
    <>
      {service.description && <p>{plain(service.description)}</p>}
      <div className="cc-vendor-company">
        {service.company && <span>{plain(service.company)}</span>}
        {privacy && (
          <a href={privacy} target="_blank" rel="noopener noreferrer">
            Privacy policy
          </a>
        )}
      </div>
      <StorageItems items={service.storage_items} />
    </>
  );
}
type Selection = {
  categories: Record<string, boolean>;
  services: Record<string, boolean>;
};
export function CookiePreferences() {
  const dashboard = usePlatform();
  const consent = useConsent();
  const runtime = useHeadlessContext()?.consent;
  const preferences = usePreferences();
  const categories = dashboard.preferences ?? [];
  const gui = object(dashboard.banner.preferences_gui_options);
  const buttons = object(dashboard.banner.preferences_buttons);
  const footer = object(dashboard.banner.footer);
  const copy = object(dashboard.copy.preferences_modal);
  const bannerCopy = object(dashboard.copy.consent_modal);
  const [draft, setDraft] = useState<Selection>({
    categories: {},
    services: {},
  });
  useEffect(() => {
    if (!preferences.open) return;
    setDraft({
      categories: { ...consent.categories },
      services: Object.fromEntries(
        categories.flatMap((category) =>
          category.services.map((service) => [
            service.consent_key,
            runtime?.hasService(service.consent_key) === true,
          ]),
        ),
      ),
    });
  }, [preferences.open, consent, categories, runtime]);
  const locked = (category: PlatformCategory) =>
    category.required ||
    (consent.regulation === "ccpa" &&
      consent.gpc === true &&
      ["marketing", "advertising"].includes(category.slug));
  const toggleCategory = (category: PlatformCategory) => {
    if (locked(category)) return;
    setDraft((previous) => {
      const enabled = !previous.categories[category.slug];
      return {
        categories: { ...previous.categories, [category.slug]: enabled },
        services: {
          ...previous.services,
          ...Object.fromEntries(
            category.services.map((service) => [service.consent_key, enabled]),
          ),
        },
      };
    });
  };
  const toggleService = (
    category: PlatformCategory,
    service: PlatformService,
  ) => {
    if (locked(category)) return;
    setDraft((previous) => {
      const services = {
        ...previous.services,
        [service.consent_key]: !previous.services[service.consent_key],
      };
      return {
        services,
        categories: {
          ...previous.categories,
          [category.slug]: category.services.some(
            (vendor) => services[vendor.consent_key],
          ),
        },
      };
    });
  };
  const vendorControls = gui.control_level === "category_and_services";
  const showServices = vendorControls || gui.show_services !== false;
  const privacy = url(dashboard.copy.privacy_policy_url);
  return (
    <Preferences.Root
      className="cc-preferences cc-platform-preferences"
      data-cc-layout={String(gui.layout ?? "box")}
      data-cc-position={String(gui.position ?? "center")}
    >
      <div className="cc-preferences__panel">
        <header className="cc-platform-heading">
          <Preferences.Title className="cc-title">
            {plain(copy.title) || "Cookie preferences"}
          </Preferences.Title>
          <Preferences.Close
            className="cc-close"
            aria-label={plain(copy.close_btn) || "Close"}
          >
            ×
          </Preferences.Close>
        </header>
        <Preferences.Description className="cc-description">
          {plain(copy.description) ||
            "Choose consent by category or vendor. Expand an item to see its details."}
        </Preferences.Description>
        {privacy && (
          <a
            className="cc-platform-policy"
            href={privacy}
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy policy
          </a>
        )}
        <div className="cc-platform-categories">
          {categories.map((category) => (
            <Disclosure
              key={category.slug}
              name={category.name}
              className="cc-platform-category"
              expandable={
                !!category.description ||
                (showServices &&
                  (category.services.length > 0 ||
                    category.storage_items.length > 0))
              }
              toggle={
                <Switch
                  name={category.name}
                  checked={
                    category.required ||
                    draft.categories[category.slug] === true
                  }
                  disabled={locked(category)}
                  onChange={() => toggleCategory(category)}
                />
              }
            >
              {category.description && <p>{plain(category.description)}</p>}
              {showServices && (
                <>
                  {category.services.map((service) => (
                    <Disclosure
                      key={service.consent_key}
                      name={service.name}
                      className="cc-platform-vendor"
                      expandable={
                        !!(
                          service.description ||
                          service.company ||
                          url(service.privacy_policy_url) ||
                          service.storage_items.length
                        )
                      }
                      toggle={
                        vendorControls ? (
                          <Switch
                            name={service.name}
                            checked={
                              category.required ||
                              draft.services[service.consent_key] === true
                            }
                            disabled={locked(category)}
                            onChange={() => toggleService(category, service)}
                          />
                        ) : undefined
                      }
                    >
                      <VendorDetails service={service} />
                    </Disclosure>
                  ))}
                  <StorageItems items={category.storage_items} />
                </>
              )}
            </Disclosure>
          ))}
        </div>
        {plain(copy.more_info_title) && (
          <h3 className="cc-platform-more-info-title">
            {plain(copy.more_info_title)}
          </h3>
        )}
        {plain(copy.more_info) && (
          <p className="cc-platform-more-info">{plain(copy.more_info)}</p>
        )}
        {footer.enabled !== false && footer.show_powered_by === true && (
          <a
            className="cc-platform-branding"
            href="https://cookiechimp.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by CookieChimp
          </a>
        )}
        <footer className="cc-actions cc-platform-actions">
          {buttons.show_accept_necessary_btn !== false && (
            <Preferences.RejectAll className="cc-button cc-button--secondary">
              {plain(copy.reject_btn) ||
                plain(bannerCopy.reject_btn) ||
                "Reject optional"}
            </Preferences.RejectAll>
          )}
          {buttons.show_save_preferences_btn !== false && (
            <Preferences.Save
              selection={draft}
              className="cc-button cc-button--secondary"
            >
              {plain(copy.save_btn) || "Save preferences"}
            </Preferences.Save>
          )}
          {buttons.show_accept_btn !== false && (
            <Preferences.AcceptAll
              className={`cc-button cc-button--${gui.equal_weight_buttons === true ? "secondary" : "primary"}`}
            >
              {plain(copy.accept_btn) ||
                plain(bannerCopy.accept_btn) ||
                "Accept all"}
            </Preferences.AcceptAll>
          )}
        </footer>
      </div>
    </Preferences.Root>
  );
}

export function RecallButton({ children }: { children?: ReactNode }) {
  const dashboard = usePlatform();
  if (
    object(dashboard.banner.preferences_gui_options).show_floating_icon ===
    false
  )
    return null;
  return (
    <BaseRecallButton>
      {children ?? (
        <>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M20.7 13.5A9 9 0 1 1 10.5 3.3a4 4 0 0 0 5.2 5.2 4 4 0 0 0 5 5Z" />
            <circle cx="8" cy="9" r=".8" />
            <circle cx="7" cy="15" r=".8" />
            <circle cx="13" cy="16" r=".8" />
            <circle cx="12" cy="11" r=".8" />
          </svg>
          <span className="cc-platform-sr-only">
            {plain(object(dashboard.copy.preferences_modal).title) ||
              "Cookie preferences"}
          </span>
        </>
      )}
    </BaseRecallButton>
  );
}
