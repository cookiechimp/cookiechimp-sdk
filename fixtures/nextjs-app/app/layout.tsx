import { consentModeInlineScript } from "@cookiechimp/core/consent-mode";
import { resolveLanguage } from "@cookiechimp/core/language";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "@cookiechimp/react/styles.css";
import "./styles.css";

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const language = resolveLanguage(
    (await headers()).get("accept-language"),
    ["en", "de", "fr"],
    "en",
  );
  return (
    <html lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the helper returns a safely JSON-escaped static script.
          dangerouslySetInnerHTML={{ __html: consentModeInlineScript() }}
        />
        <script
          data-testid="fake-gtag"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: this fixed fixture script contains no user input.
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];window.dataLayer.push(['event','fake_tag_load']);",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
