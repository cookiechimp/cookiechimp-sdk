"use client";

import { CookieBanner } from "@cookiechimp/react/banner";
import {
  CookiePreferences,
  GatedScript,
  RecallButton,
} from "@cookiechimp/react/ui";
import { ga } from "../cookiechimp.config";

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
      {/* The SDK keeps the React-owned node stable through consent changes. */}
      <GatedScript
        category={ga.category}
        service={ga.service.id}
        src={ga.script.src}
        async
      />
    </>
  );
}
