"use client";

import { gateScripts } from "@cookiechimp/core/gate";
import en from "@cookiechimp/translations/en";
import type {
  IframeHTMLAttributes,
  ReactNode,
  ScriptHTMLAttributes,
} from "react";
import { useEffect, useRef } from "react";
import { OptOut, Preferences } from "./headless";
import {
  useBanner,
  useConsent,
  useConsentActions,
  useHeadlessContext,
  usePreferences,
  useTranslations,
} from "./index";

export type {
  BannerPosition,
  CookieBannerLabels,
  CookieBannerProps,
} from "./banner";
export { CookieBanner } from "./banner";

export interface PreferenceCategory {
  id: string;
  label: string;
  description?: string;
}
export interface CookiePreferencesProps {
  title?: string;
  description?: string;
  categories: readonly PreferenceCategory[];
}
const bad = (component: string, message: string) => {
  const text = `Invalid ${component} props: ${message}`;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
    throw new Error(text);
  console.warn(text);
};

export function CookiePreferences({
  title,
  description,
  categories,
}: CookiePreferencesProps) {
  const { t } = useTranslations(en);
  if (!Array.isArray(categories)) {
    bad("CookiePreferences", "categories must be an array");
    categories = [];
  }
  return (
    <Preferences.Root className="cc-preferences">
      <div className="cc-preferences__panel">
        <Preferences.Title className="cc-title">
          {title ?? t("preferences.title")}
        </Preferences.Title>
        <Preferences.Description className="cc-description">
          {description ?? t("preferences.description")}
        </Preferences.Description>
        <div className="cc-categories">
          {categories.map((category) => (
            <Preferences.Category
              className="cc-category"
              id={category.id}
              key={category.id}
            >
              <span className="cc-category__copy">
                <strong>{category.label}</strong>
                {category.description && <small>{category.description}</small>}
              </span>
            </Preferences.Category>
          ))}
        </div>
        <div className="cc-actions">
          <Preferences.RejectAll className="cc-button cc-button--secondary">
            {t("banner.rejectAll")}
          </Preferences.RejectAll>
          <Preferences.Save className="cc-button cc-button--secondary">
            {t("banner.save")}
          </Preferences.Save>
          <Preferences.AcceptAll className="cc-button cc-button--primary">
            {t("banner.acceptAll")}
          </Preferences.AcceptAll>
          <Preferences.Close
            className="cc-close"
            aria-label={t("banner.close")}
          >
            ×
          </Preferences.Close>
        </div>
      </div>
    </Preferences.Root>
  );
}

export function RecallButton({ children }: { children?: ReactNode }) {
  const { t } = useTranslations(en);
  const preferences = usePreferences();
  const banner = useBanner();
  if (banner.open) return null;
  return (
    <button
      type="button"
      className="cc-recall"
      data-cc-part="recall"
      data-cc-state="closed"
      onClick={preferences.show}
    >
      {children ?? t("recall.label")}
    </button>
  );
}

export function CookieOptOut({
  category = "advertising",
  children,
}: {
  category?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslations(en);
  return (
    <OptOut.Root className="cc-opt-out" category={category}>
      <OptOut.Toggle
        className="cc-button cc-button--secondary"
        gpcLabel={t("gpc.honoured")}
      >
        {children ?? t("optOut.label")}
      </OptOut.Toggle>
    </OptOut.Root>
  );
}

type GateProps = { category: string; service?: string };
function useGate() {
  const runtime = useHeadlessContext()?.consent;
  useEffect(() => {
    if (!runtime) return;
    const gate = gateScripts(runtime);
    return gate.stop;
  }, [runtime]);
}
export type GatedScriptProps = GateProps &
  Omit<ScriptHTMLAttributes<HTMLScriptElement>, "src" | "type"> & {
    src?: string;
  };
export function GatedScript({
  category,
  service,
  src,
  children,
  ...props
}: GatedScriptProps) {
  if (!category) bad("GatedScript", "category is required");
  if (!src && children == null)
    bad("GatedScript", "src or inline children is required");
  useGate();
  return (
    <script
      {...props}
      type="text/plain"
      data-cc-part="gated-script"
      data-cc-state="blocked"
      data-cc-category={category}
      data-cc-service={service}
      data-cc-src={src}
    >
      {children}
    </script>
  );
}

export type GatedFrameProps = GateProps &
  Omit<IframeHTMLAttributes<HTMLIFrameElement>, "src"> & {
    src: string;
    placeholder?: ReactNode;
    allowLabel?: string;
  };
export function GatedFrame({
  category,
  service,
  src,
  placeholder,
  allowLabel,
  ...props
}: GatedFrameProps) {
  const { t } = useTranslations(en);
  if (!category) bad("GatedFrame", "category is required");
  if (!src) bad("GatedFrame", "src is required");
  const consent = useConsent();
  const runtime = useHeadlessContext()?.consent;
  const allowed = service
    ? runtime?.hasService(service) === true
    : consent.categories[category] === true;
  const { set } = useConsentActions();
  const frame = useRef<HTMLIFrameElement>(null);
  useGate();
  return (
    <div
      className="cc-frame"
      data-cc-part="gated-frame"
      data-cc-state={allowed ? "allowed" : "blocked"}
    >
      <iframe
        {...props}
        ref={frame}
        data-cc-part="gated-frame-iframe"
        data-cc-state={allowed ? "allowed" : "blocked"}
        data-cc-src={src}
        data-cc-category={category}
        data-cc-service={service}
      />
      {!allowed && (
        <div
          className="cc-frame__placeholder"
          data-cc-part="gated-frame-placeholder"
          data-cc-state="blocked"
        >
          <span>{placeholder ?? t("gated.placeholder")}</span>
          <button
            type="button"
            className="cc-button cc-button--primary"
            onClick={() =>
              set(
                service
                  ? { services: { [service]: true } }
                  : { categories: { [category]: true } },
              )
            }
          >
            {allowLabel ?? t("gated.allow")}
          </button>
        </div>
      )}
    </div>
  );
}
