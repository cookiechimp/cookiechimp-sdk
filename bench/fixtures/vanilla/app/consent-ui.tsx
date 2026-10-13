"use client";

import "vanilla-cookieconsent/dist/cookieconsent.css";
import { useEffect } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

export function ConsentUi() {
  useEffect(() => {
    void CookieConsent.run({
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: {},
        marketing: {},
      },
      language: {
        default: "en",
        translations: {
          en: {
            consentModal: {
              title: "Your privacy choices",
              description: "Choose which optional cookies this site may use.",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              showPreferencesBtn: "Preferences",
            },
            preferencesModal: {
              title: "Cookie preferences",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject all",
              savePreferencesBtn: "Save preferences",
              closeIconLabel: "Close",
              sections: [
                {
                  title: "Necessary",
                  description: "Required for this site",
                  linkedCategory: "necessary",
                },
                {
                  title: "Analytics",
                  description: "Site analytics",
                  linkedCategory: "analytics",
                },
                {
                  title: "Marketing",
                  description: "Marketing cookies",
                  linkedCategory: "marketing",
                },
              ],
            },
          },
        },
      },
    });
    return () => CookieConsent.reset();
  }, []);
  return null;
}
