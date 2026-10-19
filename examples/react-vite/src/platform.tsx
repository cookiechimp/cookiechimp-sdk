import type { ConsentState } from "@cookiechimp/core";
import { useConsent, usePreferences } from "@cookiechimp/react";
import {
  CookieBanner,
  CookiePreferences,
  PlatformConsentProvider,
  RecallButton,
} from "@cookiechimp/react/platform";
import "@cookiechimp/react/platform.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  buildDemoBundle,
  defaultOptions,
  normalizeOptions,
  type Options,
  presets,
  readOptions,
} from "./platform-config";
import { StyleControls } from "./platform-controls";
import "./platform.css";

const origin = window.location.origin;
const query = new URLSearchParams(window.location.search);
const embedded = window.parent !== window;
function clearDemoCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: Reset only the isolated example cookie.
  document.cookie = "cc_platform_demo=; Max-Age=0; Path=/; SameSite=Lax";
}
function PreviewStage({ options }: { options: Options }) {
  const consent = useConsent();
  const preferences = usePreferences();
  useEffect(() => {
    if (options.view === "preferences") preferences.show();
  }, [options.view, preferences.show]);
  useEffect(() => {
    if (!embedded) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== window.parent) return;
      if (event.data?.type === "cookiechimp-demo:preferences")
        preferences.show();
    };
    window.addEventListener("message", receive);
    window.parent.postMessage(
      { type: "cookiechimp-demo:ready", run: query.get("run") },
      origin,
    );
    return () => window.removeEventListener("message", receive);
  }, [preferences.show]);
  useEffect(() => {
    if (embedded)
      window.parent.postMessage(
        {
          type: "cookiechimp-demo:state",
          state: consent,
          run: query.get("run"),
        },
        origin,
      );
  }, [consent]);
  return (
    <>
      <main className="demo-site">
        <nav aria-label="Example website">
          <span className="demo-site__brand">
            <span aria-hidden="true">◒</span> Example company
          </span>
          <span>Live consent experience</span>
        </nav>
        <div className="demo-site__content">
          <p className="demo-site__label">
            Your website, your consent experience
          </p>
          <h1>
            Make privacy feel
            <br />
            part of your product.
          </h1>
          <p>
            Explore the banner, choose individual vendors and inspect the
            cookies behind every category. These controls are the actual
            CookieChimp React SDK.
          </p>
          <button type="button" onClick={preferences.show}>
            Manage cookie preferences
          </button>
          <p className="demo-site__note">
            Demo only. Vendor tags are not loaded and consent records are not
            sent.
          </p>
        </div>
        <section
          className="demo-site__state"
          aria-label="Live consent JSON"
          aria-live="polite"
        >
          <h2>Live SDK consent state</h2>
          <pre>
            {JSON.stringify(
              {
                consentId: consent.consentId,
                categories: consent.categories,
                services: consent.services,
                action: consent.action,
              },
              null,
              2,
            )}
          </pre>
        </section>
      </main>
      <CookieBanner />
      <CookiePreferences />
      <RecallButton />
    </>
  );
}
function DirectDemo() {
  const [options, setOptions] = useState(readOptions);
  const configured = useMemo(() => buildDemoBundle(options, origin), [options]);
  return (
    <div
      className={
        embedded ? "demo-document" : "demo-document demo-document--standalone"
      }
    >
      {!embedded && (
        <aside className="standalone-controls">
          <a href="/platform.html">Back to the playground</a>
          <StyleControls value={options} onChange={setOptions} />
          <button
            type="button"
            onClick={() => {
              clearDemoCookie();
              window.location.reload();
            }}
          >
            Reset demo
          </button>
        </aside>
      )}
      <PlatformConsentProvider
        key={`${options.mode}:${options.locale}`}
        bundle={configured}
        region="IE"
        locale={options.locale}
        cookie={{ name: "cc_platform_demo", maxAge: 3600 }}
        motion={options.motion}
      >
        <PreviewStage options={options} />
      </PlatformConsentProvider>
    </div>
  );
}
function Playground() {
  const [options, setOptions] = useState(() => structuredClone(defaultOptions));
  const [selected, setSelected] = useState("box-inline");
  const [nonce, setNonce] = useState(0);
  const [fresh, setFresh] = useState(true);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [copied, setCopied] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const configured = useMemo(() => buildDemoBundle(options, origin), [options]);
  const json = useMemo(() => JSON.stringify(configured, null, 2), [configured]);
  const previewUrl = `/platform.html?${new URLSearchParams({ preview: "1", options: JSON.stringify(options), fresh: fresh ? "1" : "0", run: String(nonce) })}`;
  const fullPageUrl = `/platform.html?${new URLSearchParams({ preview: "1", options: JSON.stringify(options) })}`;
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (event.data?.run !== String(nonce)) return;
      if (event.data?.type === "cookiechimp-demo:ready") setReady(true);
      if (
        event.data?.type === "cookiechimp-demo:state" &&
        event.data.state?.schemaVersion === 1
      )
        setConsent(event.data.state);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [nonce]);
  const restart = (reset: boolean) => {
    setReady(false);
    setFresh(reset);
    setNonce((value) => value + 1);
  };
  const change = (next: Options, preset = "custom") => {
    setOptions(normalizeOptions(next));
    setSelected(preset);
    setConsent(null);
    setCopied("");
    restart(true);
    if (preset !== "custom")
      frame.current
        ?.closest(".playground__preview")
        ?.scrollIntoView({ block: "start" });
  };
  const active = presets.find((preset) => preset.id === selected);
  return (
    <main className="playground">
      <header className="playground__header">
        <a href="https://cookiechimp.com" className="playground__wordmark">
          CookieChimp <span>React SDK</span>
        </a>
        <a
          href="https://docs.cookiechimp.com/docs/sdk/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Documentation
        </a>
      </header>
      <section className="playground__intro">
        <div>
          <h1>Explore the React SDK.</h1>
          <p>
            Choose a preset, tune the details and test real category and vendor
            consent.
          </p>
        </div>
        <a href="#sdk-live-preview">Jump to the live preview</a>
      </section>
      <section className="playground__presets" aria-label="Demo presets">
        {["Layouts", "Experiences"].map((group) => (
          <div className="playground__preset-group" key={group}>
            <h2>{group}</h2>
            <div className="playground__preset-list">
              {presets
                .filter((preset) => preset.group === group)
                .map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected === preset.id}
                    title={preset.detail}
                    onClick={() =>
                      change(
                        {
                          ...structuredClone(defaultOptions),
                          ...preset.options,
                        },
                        preset.id,
                      )
                    }
                  >
                    {preset.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </section>
      <div className="playground__workbench">
        <aside className="playground__controls" aria-label="Customize the demo">
          <div className="playground__controls-heading">
            <h2>Fine-tune the details</h2>
            <button
              type="button"
              onClick={() =>
                change(structuredClone(defaultOptions), "box-inline")
              }
            >
              Reset settings
            </button>
          </div>
          <StyleControls value={options} onChange={change} />
        </aside>
        <section
          id="sdk-live-preview"
          className="playground__preview"
          aria-label="SDK preview"
        >
          <header className="playground__preview-heading">
            <div>
              <span className="live-dot" aria-hidden="true" />
              <h2>{active?.name ?? "Custom configuration"}</h2>
            </div>
            <fieldset className="playground__viewports">
              <legend className="visually-hidden">Preview size</legend>
              <button
                type="button"
                aria-pressed={!mobile}
                onClick={() => setMobile(false)}
              >
                Desktop
              </button>
              <button
                type="button"
                aria-pressed={mobile}
                onClick={() => setMobile(true)}
              >
                Mobile
              </button>
            </fieldset>
          </header>
          <div
            className={`playground__canvas ${mobile ? "playground__canvas--mobile" : ""}`}
          >
            <iframe
              ref={frame}
              id="sdk-preview"
              title="Live CookieChimp SDK preview"
              src={previewUrl}
            />
          </div>
          <div className="playground__toolbar">
            <button
              type="button"
              onClick={() => {
                setOptions((current) => ({ ...current, view: "banner" }));
                restart(true);
              }}
            >
              Replay banner
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() =>
                frame.current?.contentWindow?.postMessage(
                  { type: "cookiechimp-demo:preferences" },
                  origin,
                )
              }
            >
              Open preferences
            </button>
            <button type="button" onClick={() => restart(false)}>
              Reload saved choices
            </button>
            <a href={fullPageUrl} target="_blank" rel="noopener noreferrer">
              Open full page
            </a>
          </div>
          <p className="playground__hint">
            Changing a preset or setting starts a fresh demo. Save your choices,
            then reload them to check persistence. Only the one-hour demo cookie
            is used.
          </p>
          <section
            className="playground__consent"
            aria-label="Current consent"
            aria-live="polite"
          >
            <div>
              <h3>Consent, as it happens</h3>
              <span>
                {consent
                  ? `${consent.action.replaceAll("_", " ")} / ${consent.regulation}`
                  : "Starting preview…"}
              </span>
            </div>
            <pre>
              {consent
                ? JSON.stringify(
                    {
                      consentId: consent.consentId,
                      categories: consent.categories,
                      services: consent.services,
                      action: consent.action,
                    },
                    null,
                    2,
                  )
                : "Waiting for the SDK"}
            </pre>
          </section>
          <details className="playground__json">
            <summary>Inspect the platform JSON</summary>
            <div>
              <p>
                This is the same configuration used to build the live widget.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(json);
                    setCopied("JSON copied");
                  } catch {
                    setCopied("Select the JSON below to copy it.");
                  }
                }}
              >
                Copy JSON
              </button>
              <span role="status">{copied}</span>
            </div>
            <textarea
              aria-label="Platform JSON configuration"
              readOnly
              value={json}
              rows={18}
            />
          </details>
        </section>
      </div>
      <footer className="playground__footer">
        <p>
          Realistic Google Analytics, Microsoft Clarity and Meta Pixel
          disclosures. No analytics or advertising tags load in this demo.
        </p>
        <p>
          TCF, tag gating and consent delivery use their explicit SDK
          integrations.
        </p>
      </footer>
    </main>
  );
}
const root =
  document.getElementById("root") ??
  document.getElementById("react-sdk-demo-root");
if (query.get("preview") === "1" && query.get("fresh") === "1")
  clearDemoCookie();
if (root)
  createRoot(root).render(
    query.get("preview") === "1" ? <DirectDemo /> : <Playground />,
  );
