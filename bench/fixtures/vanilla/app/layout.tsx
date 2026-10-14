import "../../shared/styles.css";
import type { ReactNode } from "react";
import { ConsentUi } from "./consent-ui";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ConsentUi />
      </body>
    </html>
  );
}
