import { createConsent } from "@cookiechimp/core";
import {
  ConsentProvider,
  useCategory,
  usePreferences,
} from "@cookiechimp/react";
import { CookieBanner } from "@cookiechimp/react/banner";
import {
  CookiePreferences,
  GatedScript,
  RecallButton,
} from "@cookiechimp/react/ui";
import "@cookiechimp/react/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

// Create one runtime outside React renders. Apps supply trusted region context;
// this example's regulation is configured explicitly and performs no geolocation.
const consent = createConsent({
  categories: { analytics: false },
  regulation: "gdpr",
});

function App() {
  const analytics = useCategory("analytics");
  const preferences = usePreferences();
  return (
    <main>
      <p className="eyebrow">CookieChimp SDK / React + Vite</p>
      <h1>Your app, your consent choices.</h1>
      <p>
        This example keeps analytics blocked until you choose to allow it. Your
        decision survives a page reload.
      </p>
      <p data-testid="analytics-status">
        {analytics ? "Analytics is allowed." : "Analytics is not allowed."}
      </p>
      <p>
        When enabled, the demo script records a local counter. It makes no
        analytics network requests.
      </p>
      <button type="button" onClick={preferences.show}>
        Change cookie settings
      </button>
      <GatedScript category="analytics">
        {
          "window.__exampleAnalyticsRuns = (window.__exampleAnalyticsRuns || 0) + 1;"
        }
      </GatedScript>
      <CookieBanner />
      <CookiePreferences
        categories={[
          {
            id: "analytics",
            label: "Analytics",
            description: "Understand usage of this app.",
          },
        ]}
      />
      <RecallButton />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing React mount point");
createRoot(root).render(
  <StrictMode>
    <ConsentProvider consent={consent}>
      <App />
    </ConsentProvider>
  </StrictMode>,
);
