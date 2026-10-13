"use client";

import "@cookieyes/nextjs/styles.css";
import {
  CookieBanner,
  CookiePreferences,
  initCookieYes,
  RecallButton,
} from "@cookieyes/nextjs";

// Public API integration only. No vendor implementation is copied.
initCookieYes({ mode: "cookie-only", regulation: "GDPR" });

export function ConsentUi() {
  return (
    <>
      <CookieBanner />
      <CookiePreferences />
      <RecallButton />
    </>
  );
}
