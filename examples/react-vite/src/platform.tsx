import { useConsent, usePreferences } from "@cookiechimp/react";
import {
  CookieBanner,
  CookiePreferences,
  PlatformConsentProvider,
  RecallButton,
} from "@cookiechimp/react/platform";
import "@cookiechimp/react/platform.css";
import { createRoot } from "react-dom/client";
import bundle from "../../../packages/core/src/fixtures/platform-offline-bundle.json";
import "./platform.css";

function App() {
  const consent = useConsent();
  const preferences = usePreferences();
  return (
    <div className="platform-demo">
      <p className="platform-demo__label">CookieChimp React SDK</p>
      <h1>Your choices, down to each vendor.</h1>
      <p>
        Open preferences to explore categories, individual vendors, privacy
        policies and cookie details. Everything comes from the same platform
        JSON configuration.
      </p>
      <div className="platform-demo__actions">
        <button type="button" onClick={preferences.show}>
          Manage cookie preferences
        </button>
        <button
          type="button"
          onClick={() => {
            // biome-ignore lint/suspicious/noDocumentCookie: Reset only the isolated demo cookie.
            document.cookie =
              "cc_platform_demo=; Max-Age=0; Path=/; SameSite=Lax";
            window.location.reload();
          }}
        >
          Reset demo
        </button>
      </div>
      <section
        className="platform-demo__state"
        aria-live="polite"
        aria-label="Live consent JSON"
      >
        <h2>Live SDK consent state</h2>
        <pre>
          <code>
            {JSON.stringify(
              {
                categories: consent.categories,
                services: consent.services,
                action: consent.action,
              },
              null,
              2,
            )}
          </code>
        </pre>
      </section>
      <p className="platform-demo__note">
        This example saves choices in a separate one-hour demo cookie. It does
        not load analytics or advertising tags, or send consent logs.
      </p>
      <CookieBanner />
      <CookiePreferences />
      <RecallButton />
    </div>
  );
}
const root =
  document.getElementById("root") ??
  document.getElementById("react-sdk-demo-root");
if (root)
  createRoot(root).render(
    <PlatformConsentProvider
      bundle={bundle}
      region="IE"
      locale="en"
      cookie={{ name: "cc_platform_demo", maxAge: 3600 }}
    >
      <App />
    </PlatformConsentProvider>,
  );
