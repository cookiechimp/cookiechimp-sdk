import { ConsentProvider } from "@cookiechimp/react";
import {
  CookieBanner,
  CookiePreferences,
  RecallButton,
} from "@cookiechimp/react/ui";
import { createElement, Fragment } from "react";

const categories = [
  { id: "analytics", label: "Analytics" },
  { id: "marketing", label: "Marketing" },
] as const;
const config = {
  categories: ["analytics", "marketing"],
};

export const UiScenario = () =>
  createElement(ConsentProvider, {
    config,
    children: createElement(
      Fragment,
      null,
      createElement(CookieBanner),
      createElement(CookiePreferences, { categories }),
      createElement(RecallButton),
    ),
  });
