import type { Framework } from "./project";

export interface Scaffold {
  files: { path: string; content: string }[];
  /** Manual edits printed for the user; existing files are never changed. */
  instructions: string[];
}

const config = `import type { ConsentConfig } from "@cookiechimp/core";

/** Edit categories and services to match the cookies and scripts your site uses. */
export const consentConfig = {
  categories: {
    analytics: false,
    marketing: false,
  },
} satisfies ConsentConfig;
`;

const join = (...parts: string[]) => parts.filter(Boolean).join("/");

export function scaffold(framework: Framework, srcDir: string): Scaffold {
  const configPath = join(srcDir, "cookiechimp.config.ts");
  if (framework === "next-app") {
    const banner = join(srcDir, "components", "cookiechimp-banner.tsx");
    return {
      files: [
        { path: configPath, content: config },
        {
          path: banner,
          content: `"use client";

import { CookieBanner } from "@cookiechimp/react/banner";

export function CookieChimpBanner() {
  return <CookieBanner />;
}
`,
        },
      ],
      instructions: [
        `In ${join(srcDir, "app", "layout.tsx")}, add:`,
        `  import "@cookiechimp/react/styles.css";`,
        `  import { CookieChimpProvider } from "@cookiechimp/nextjs/server";`,
        '  import { consentConfig } from "../cookiechimp.config";',
        '  import { CookieChimpBanner } from "../components/cookiechimp-banner";',
        "Then wrap the body content:",
        "  <CookieChimpProvider config={consentConfig}>{children}<CookieChimpBanner /></CookieChimpProvider>",
      ],
    };
  }
  const provider =
    framework === "vanilla"
      ? join(srcDir, "cookiechimp.ts")
      : join(srcDir, "components", "cookiechimp-provider.tsx");
  if (framework === "vanilla")
    return {
      files: [
        { path: configPath, content: config },
        {
          path: provider,
          content: `import { createConsent } from "@cookiechimp/core";
import { gateScripts } from "@cookiechimp/core/gate";
import { consentConfig } from "./cookiechimp.config";

export const consent = createConsent(consentConfig);
// Scripts marked type="text/plain" with data-cc-src and data-cc-category stay blocked until consent.
export const gate = gateScripts(consent);
`,
        },
      ],
      instructions: [
        `Import ${provider.replace(/\.ts$/, "")} once, as early as possible in your page.`,
        "Then build your banner with consent.acceptAll(), consent.rejectAll() and consent.set().",
      ],
    };
  return {
    files: [
      { path: configPath, content: config },
      {
        path: provider,
        content: `"use client";

import "@cookiechimp/react/styles.css";
import { ConsentProvider } from "@cookiechimp/react";
import { CookieBanner } from "@cookiechimp/react/banner";
import type { ReactNode } from "react";
import { consentConfig } from "../cookiechimp.config";

export function CookieChimp({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider config={consentConfig}>
      {children}
      <CookieBanner />
    </ConsentProvider>
  );
}
`,
      },
    ],
    instructions: [
      framework === "next-pages"
        ? `In ${join(srcDir, "pages", "_app.tsx")}, wrap <Component {...pageProps} /> with <CookieChimp> from "../components/cookiechimp-provider".`
        : `Wrap your app root with <CookieChimp> from "./${join("components", "cookiechimp-provider")}" (relative to ${srcDir || "your entry"}).`,
    ],
  };
}
