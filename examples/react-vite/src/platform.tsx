import { useConsent, usePreferences } from "@cookiechimp/react";
import {
  CookieBanner,
  CookiePreferences,
  PlatformConsentProvider,
  RecallButton,
} from "@cookiechimp/react/platform";
import "@cookiechimp/react/platform.css";
import { type ReactNode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import bundle from "../../../packages/core/src/fixtures/platform-offline-bundle.json";
import { defaultOptions, StyleControls } from "./platform-controls";
import "./platform.css";

function App({
  motion,
  onMotionChange,
  controls,
}: {
  controls: ReactNode;
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
      {controls}
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
  const [options, setOptions] = useState(defaultOptions);
  const configured = useMemo(() => {
    const result = structuredClone(bundle);
    const banner = result.banners.bnrEU1;
    Object.assign(banner.gui_options, {
      layout: options.layout,
      position: options.position,
      button_placement: options.placement,
      equal_weight_buttons: options.equal,
      swap_buttons: options.swap,
    });
    Object.assign(banner.preferences_gui_options, {
      layout: options.panel.startsWith("bar") ? "bar" : "box",
      position: options.panel.endsWith("left") ? "left" : "right",
      equal_weight_buttons: options.equal,
    });
    Object.assign(banner.theme, {
      dark_mode: options.theme,
      modal_border_radius: options.radius,
      btn_border_radius: options.radius,
    });
    banner.force_consent = options.force;
    return result;
  }, [options]);
  return (
    <PlatformConsentProvider
      bundle={configured}
      region="IE"
      locale="en"
      cookie={{ name: "cc_platform_demo", maxAge: 3600 }}
      motion={motion}
    >
      <App
        motion={motion}
        onMotionChange={setMotion}
        controls={<StyleControls value={options} onChange={setOptions} />}
      />
    </PlatformConsentProvider>
  );
}
if (root) createRoot(root).render(<Demo />);
