import "../../shared/styles.css";
import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import type { ReactNode } from "react";
import { ConsentUi } from "./consent-ui";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CookieChimpProvider
          config={{
            categories: { analytics: false, marketing: false },
            regulation: "gdpr",
          }}
        >
          {children}
          <ConsentUi />
        </CookieChimpProvider>
      </body>
    </html>
  );
}
