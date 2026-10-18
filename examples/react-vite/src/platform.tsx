import { useConsent, usePreferences } from "@cookiechimp/react";
import {
  CookieBanner,
  CookiePreferences,
  PlatformConsentProvider,
  RecallButton,
} from "@cookiechimp/react/platform";
import "@cookiechimp/react/platform.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import bundle from "../../../packages/core/src/fixtures/platform-offline-bundle.json";
import "./platform.css";

function App({
  motion,
  onMotionChange,
}: {
  motion: boolean;
  onMotionChange(value: boolean): void;
}) {
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
      <label className="platform-demo__motion">
        <input
          type="checkbox"
          checked={motion}
          onChange={(event) => onMotionChange(event.target.checked)}
        />
        Animate interactions
      </label>
      <p className="platform-demo__note">
        Motion is included by default and respects reduced-motion preferences.
        To disable it in your app, pass <code>motion={"{false}"}</code> to{" "}
        <code>PlatformConsentProvider</code>.
      </p>
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
function Demo() {
  const [motion, setMotion] = useState(true);
  return (
    <PlatformConsentProvider
      bundle={bundle}
      region="IE"
      locale="en"
      cookie={{ name: "cc_platform_demo", maxAge: 3600 }}
      motion={motion}
    >
      <App motion={motion} onMotionChange={setMotion} />
    </PlatformConsentProvider>
  );
}
if (root) createRoot(root).render(<Demo />);
