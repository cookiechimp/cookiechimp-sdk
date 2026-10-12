import { consentModeInlineScript } from "@cookiechimp/core/consent-mode";
import type { ReactNode } from "react";
import "./styles.css";

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
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
