import "@cookiechimp/react/styles.css";
import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import type { ReactNode } from "react";
import { ConsentUi } from "../components/consent-ui";
import { consentConfig } from "../cookiechimp.config";

export const metadata = { title: "CookieChimp App Router example" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Reads the consent cookie on the server, so the banner never flashes. */}
        <CookieChimpProvider config={consentConfig}>
          {children}
          <ConsentUi />
        </CookieChimpProvider>
      </body>
    </html>
  );
}
