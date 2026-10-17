import { type ConsentRuntime, createConsent } from "@cookiechimp/core";
import {
  type ConsentLog,
  createConsentLog,
} from "@cookiechimp/core/consent-log";
import { createSync, type DashboardConfig } from "@cookiechimp/core/sync";
import { ConsentProvider, type Messages } from "@cookiechimp/react";
import { CookieBanner } from "@cookiechimp/react/banner";
import { CookiePreferences, RecallButton } from "@cookiechimp/react/ui";
import { type FormEvent, useEffect, useState } from "react";

const API = "https://cookiechimp.com";
const PROJECT = /^(?!cc_(?:sk|pk)_)[\w-]{1,64}$/;
const initialProject =
  new URLSearchParams(window.location.search).get("project") ?? "";

// Dashboard HTML is never injected into the page. Rich-text fields fall back
// to the SDK's text labels, just as in the Next.js provider.
function messages(dashboard: DashboardConfig): Messages {
  const result: Record<string, string> = {};
  for (const [section, field, key] of [
    ["consent_modal", "title", "banner.title"],
    ["consent_modal", "description", "banner.description"],
    ["consent_modal", "accept_btn", "banner.acceptAll"],
    ["consent_modal", "reject_btn", "banner.rejectAll"],
    ["consent_modal", "preferences_btn", "banner.customize"],
    ["preferences_modal", "title", "preferences.title"],
    ["preferences_modal", "save_btn", "banner.save"],
  ] as const) {
    const group = dashboard.copy[section];
    const value =
      group && typeof group === "object"
        ? (group as Record<string, unknown>)[field]
        : undefined;
    if (
      typeof value === "string" &&
      value.trim() &&
      value.length <= 500 &&
      !/[<>]/.test(value)
    )
      result[key] = value;
  }
  return result as Messages;
}

function cookie(dashboard: DashboardConfig) {
  const name = dashboard.cookie.name;
  const validDays = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 730;
  const bannerDays = dashboard.banner.expires_days;
  const days = validDays(bannerDays)
    ? bannerDays
    : dashboard.cookie.expires_days;
  return {
    ...(typeof name === "string" &&
    /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/.test(name)
      ? { name }
      : {}),
    ...(validDays(days) ? { maxAge: days * 86400 } : {}),
  };
}

type Connection = { consent: ConsentRuntime; dashboard: DashboardConfig };

export function ConnectedExample() {
  const [input, setInput] = useState(initialProject);
  const [request, setRequest] = useState({
    projectId: PROJECT.test(initialProject) ? initialProject : "",
  });
  const projectId = request.projectId;
  const [connection, setConnection] = useState<Connection>();
  const [status, setStatus] = useState(
    "Enter your public CookieChimp account ID to connect.",
  );
  const [delivery, setDelivery] = useState(
    "No consent decision sent in this session.",
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const projectId = request.projectId;
    if (!projectId) return;
    let active = true;
    let log: ConsentLog | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    setConnection(undefined);
    setPending(0);
    setDelivery("No consent decision sent in this session.");
    setStatus("Fetching configuration from CookieChimp...");
    const sync = createSync({
      projectId,
      apiBase: API,
      // This example uses application-supplied Ireland context and English.
      // Production apps supply their own trusted region; no geo lookup runs.
      region: "IE",
      locale: "en",
      revalidate: false,
    });
    void sync.revalidate().then((state) => {
      if (!active) return;
      const dashboard = state.dashboard;
      if (
        state.status !== "ready" ||
        state.source !== "dashboard" ||
        !dashboard
      ) {
        setStatus(
          `Live configuration unavailable (${state.error ?? state.status}). Check the account ID and platform deployment, then retry.`,
        );
        return;
      }
      log = createConsentLog({
        projectId,
        apiBase: API,
        bannerId: dashboard.bannerId,
        serviceCategories: Object.fromEntries(
          dashboard.services.map((service) => [service.id, service.category]),
        ),
        // Observe the real platform receipt without changing the SDK's retry
        // transport. An empty queue by itself is not proof of successful delivery.
        fetch: async (url, options) => {
          try {
            const response = await fetch(url, options);
            if (active)
              setDelivery(
                response.ok
                  ? "Platform responded; awaiting a matching receipt."
                  : "Platform request failed; the decision stays queued for retry.",
              );
            try {
              const sent = JSON.parse(String(options?.body)).consents as {
                client_id: string;
              }[];
              const ids = new Set(sent.map((record) => record.client_id));
              const receipt = await response.clone().json();
              const acknowledged = Array.isArray(receipt?.synced)
                ? receipt.synced.filter((record: { client_id?: string }) =>
                    ids.has(record?.client_id ?? ""),
                  ).length
                : 0;
              if (active && response.ok && acknowledged > 0)
                setDelivery(
                  `Platform acknowledged ${acknowledged} consent record(s).`,
                );
              else if (
                active &&
                Array.isArray(receipt?.failed) &&
                receipt.failed.length > 0
              )
                setDelivery(
                  "The platform rejected the consent record. Inspect the response before marking delivery verified.",
                );
            } catch {
              /* A missing receipt is displayed as unconfirmed. */
            }
            return response;
          } catch (error) {
            if (active)
              setDelivery(
                "Delivery unavailable; the decision stays queued for retry.",
              );
            throw error;
          }
        },
      });
      const consentLog = log;
      const consent = createConsent({
        categories: dashboard.categories,
        services: dashboard.services,
        cookie: cookie(dashboard),
        language: dashboard.language,
        region: { country: "IE" },
        onConsent(record) {
          consentLog.record(record, dashboard.language);
          if (active) {
            setDelivery("Consent decision queued for CookieChimp.");
            setPending(consentLog.pending());
          }
          void consentLog.flush();
        },
      });
      timer = setInterval(() => {
        if (active) setPending(consentLog.pending());
      }, 200);
      setPending(consentLog.pending());
      setConnection({ consent, dashboard });
      setStatus(
        `Configuration loaded from CookieChimp. Banner ${dashboard.bannerId}; version ${dashboard.configVersion}.`,
      );
    });
    return () => {
      active = false;
      clearInterval(timer);
      log?.destroy();
      sync.destroy();
    };
  }, [request]);

  function connect(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!PROJECT.test(value)) {
      setStatus(
        "Use the public account ID from the CookieChimp installation snippet, never an API key or secret.",
      );
      return;
    }
    window.history.replaceState(
      null,
      "",
      `/connected?project=${encodeURIComponent(value)}`,
    );
    setRequest({ projectId: value });
  }

  return (
    <main>
      <p className="eyebrow">
        CookieChimp SDK / Backend-connected React example
      </p>
      <h1>Consent connected to your CookieChimp account.</h1>
      <p>
        This example loads your dashboard configuration and sends consent
        decisions to CookieChimp. Use a dedicated test account for verification.
      </p>
      <form onSubmit={connect}>
        <label htmlFor="project-id">Public CookieChimp account ID</label>
        <input
          id="project-id"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
        />
        <button type="submit">Load CookieChimp configuration</button>
      </form>
      <p role="status" data-testid="connected-config">
        {status}
      </p>
      {projectId && (
        <>
          <p>
            Configuration:{" "}
            <code>
              {API}/api/v1/mobile-sdk/offline/{projectId}
            </code>
          </p>
          <p>
            Consent delivery:{" "}
            <code>
              {API}/api/v1/mobile-sdk/sync/{projectId}
            </code>
          </p>
        </>
      )}
      <p role="status" data-testid="connected-delivery">
        {delivery}
      </p>
      <p data-testid="connected-pending">Queued records: {pending}</p>
      {connection && (
        <ConsentProvider
          consent={connection.consent}
          translations={messages(connection.dashboard)}
        >
          <CookieBanner />
          <CookiePreferences
            categories={connection.dashboard.categories.map((category) => ({
              id: category.id,
              label: category.label ?? category.id,
              description: category.description,
            }))}
          />
          <RecallButton />
        </ConsentProvider>
      )}
      <p>
        <a href="/">View the local-only React example</a>
      </p>
    </main>
  );
}
