import "../../shared/styles.css";
import { CookieYesProvider } from "@cookieyes/nextjs";
import { getServerConsent } from "@cookieyes/nextjs/server";
import type { ReactNode } from "react";
import { ConsentUi } from "./consent-ui";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: ReactNode }) {
  const initialConsent = await getServerConsent({ regulation: "GDPR" });
  return (
    <html lang="en">
      <body>
        <CookieYesProvider regulation="GDPR" initialConsent={initialConsent}>
          {children}
          <ConsentUi />
        </CookieYesProvider>
      </body>
    </html>
  );
}
