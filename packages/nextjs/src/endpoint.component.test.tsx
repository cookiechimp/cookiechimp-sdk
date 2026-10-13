import { useConsentActions } from "@cookiechimp/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ClientProvider } from "./index";
import { PagesConsentProvider } from "./pages";

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  localStorage.clear();
  // biome-ignore lint/suspicious/noDocumentCookie: tests reset the SDK's cookie between cases.
  document.cookie = "cc_consent=; Max-Age=0; Path=/";
});

function Accept() {
  const actions = useConsentActions();
  return (
    <button type="button" onClick={() => actions.acceptAll()}>
      accept
    </button>
  );
}
const config = {
  categories: { analytics: false },
  regulation: "gdpr" as const,
};
const endpoint = { url: "/api/consent", headers: { "X-Site": "shop" } };

describe("Next.js providers forward endpoint", () => {
  it.each([
    [
      "ClientProvider (App Router bridge)",
      <ClientProvider key="a" config={config} endpoint={endpoint}>
        <Accept />
      </ClientProvider>,
    ],
    [
      "PagesConsentProvider",
      <PagesConsentProvider
        key="p"
        config={config}
        consent={null}
        region={null}
        endpoint={endpoint}
      >
        <Accept />
      </PagesConsentProvider>,
    ],
  ])("%s", async (_name, element) => {
    const fetch = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(""),
    );
    vi.stubGlobal("fetch", fetch);
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    await act(async () => root.render(element));
    await act(async () => container.querySelector("button")?.click());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      headers: { "X-Site": "shop" },
    });
    await act(async () => root.unmount());
  });
});
