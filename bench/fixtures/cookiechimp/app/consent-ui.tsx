"use client";

import "@cookiechimp/react/styles.css";
import { CookieBanner } from "@cookiechimp/react/banner";
import { CookiePreferences, RecallButton } from "@cookiechimp/react/ui";

const categories = [
  { id: "necessary", label: "Necessary" },
  { id: "analytics", label: "Analytics" },
  { id: "marketing", label: "Marketing" },
];

export function ConsentUi() {
  return (
    <>
      <CookieBanner />
      <CookiePreferences categories={categories} />
      <RecallButton />
    </>
  );
}
