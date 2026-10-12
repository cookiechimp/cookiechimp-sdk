"use client";

import { gateScripts } from "@cookiechimp/core/gate";
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
  title = "Cookie preferences",
  description = "Choose which cookie categories you allow.",
  categories,
}: CookiePreferencesProps) {
  if (!Array.isArray(categories)) {
    bad("CookiePreferences", "categories must be an array");
    categories = [];
  }
  return (
    <Preferences.Root className="cc-preferences">
      <div className="cc-preferences__panel">
        <Preferences.Title className="cc-title">{title}</Preferences.Title>
        <Preferences.Description className="cc-description">
          {description}
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
            Reject all
          </Preferences.RejectAll>
          <Preferences.Save className="cc-button cc-button--secondary">
            Save choices
          </Preferences.Save>
          <Preferences.AcceptAll className="cc-button cc-button--primary">
            Accept all
          </Preferences.AcceptAll>
          <Preferences.Close
            className="cc-close"
            aria-label="Close preferences"
          >
            ×
          </Preferences.Close>
        </div>
      </div>
    </Preferences.Root>
  );
}

export function RecallButton({
  children = "Cookie preferences",
}: {
  children?: ReactNode;
}) {
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
      {children}
    </button>
  );
}

export function CookieOptOut({
  category = "advertising",
}: {
  category?: string;
}) {
  return (
    <OptOut.Root className="cc-opt-out" category={category}>
      <OptOut.Toggle className="cc-button cc-button--secondary" />
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
  placeholder = "This content requires consent.",
  allowLabel = "Allow",
  ...props
}: GatedFrameProps) {
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
          <span>{placeholder}</span>
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
            {allowLabel}
          </button>
        </div>
      )}
    </div>
  );
}
