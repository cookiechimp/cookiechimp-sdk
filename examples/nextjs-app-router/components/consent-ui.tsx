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
      {/*
        Stays type="text/plain" and never requests GA4 until analytics is
        allowed. Keep GatedScript as the only child of an element whose
        children never change: activation currently replaces the script node,
        which breaks React if siblings re-render next to it.
      */}
      <div hidden>
        <GatedScript
          category={ga.category}
          service={ga.service.id}
          src={ga.script.src}
          async
        />
      </div>
    </>
  );
}
