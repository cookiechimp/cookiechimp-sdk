import { dirFor, resolveLanguage } from "@cookiechimp/core/language";
import {
  CookieChimpProvider,
  CookieChimpStyles,
  GoogleConsentMode,
} from "@cookiechimp/nextjs/server";
import "@cookiechimp/react/styles.css";
import { rtlLocales } from "@cookiechimp/translations";
import de from "@cookiechimp/translations/de";
import en from "@cookiechimp/translations/en";
import fr from "@cookiechimp/translations/fr";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { consentConfig } from "../consent-config";
import "./styles.css";

const languages = { available: ["en", "de", "fr"], fallback: "en" } as const;
const messages = { en, de, fr };

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const language = resolveLanguage(
    (await headers()).get("accept-language"),
    languages.available,
    languages.fallback,
  );
  return (
    <html lang={language} dir={dirFor(language, rtlLocales)}>
      <head>
        <CookieChimpStyles />
        <GoogleConsentMode />
        <script
          data-testid="fake-gtag"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: this fixed fixture script contains no user input.
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];window.dataLayer.push(['event','fake_tag_load']);",
          }}
        />
      </head>
      <body>
        <CookieChimpProvider
          config={consentConfig}
          provider="vercel"
          languages={languages}
          translations={(locale) => messages[locale as keyof typeof messages]}
        >
          {children}
        </CookieChimpProvider>
      </body>
    </html>
  );
}
