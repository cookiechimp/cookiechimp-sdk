import { ConsentProvider } from "@cookiechimp/react";
import { CookieBanner } from "@cookiechimp/react/banner";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { consentConfig } from "../consent-config";
import { ConsentLogDemo } from "./consent-log-demo";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  // biome-ignore lint/suspicious/noDocumentCookie: expire the fixture cookie between tests.
  document.cookie = "cc_consent=; Path=/; Max-Age=0";
  vi.unstubAllGlobals();
});

async function renderAndAccept() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() =>
    root.render(
      <ConsentProvider config={consentConfig}>
        <CookieBanner />
        <ConsentLogDemo />
      </ConsentProvider>,
    ),
  );
  const accept = [...document.querySelectorAll("button")].find((button) =>
    /accept all/i.test(button.textContent ?? ""),
  );
  expect(accept).toBeDefined();
  await act(async () => accept?.click());
  return root;
}

it("accepting in the banner POSTs one platform record with only the documented fields", async () => {
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { consents } = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        synced: consents.map((item: { client_id: string }) => ({
          client_id: item.client_id,
        })),
        failed: [],
      }),
    );
  });
  vi.stubGlobal("fetch", fetch);
  const root = await renderAndAccept();
  expect(document.cookie).toContain("cc_consent=v1.");
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(String(url)).toBe(
    "https://api.cookiechimp.test/api/v1/mobile-sdk/sync/acctREDACTED",
  );
  expect(init).toMatchObject({ credentials: "omit", keepalive: true });
  const [record] = JSON.parse(String(init?.body)).consents;
  expect(Object.keys(record).sort()).toEqual(
    [
      "client_id",
      "consent_banner_hashid",
      "created_at",
      "gpc_preference",
      "language_code",
      "platform",
      "url",
      "user_preferences",
      "uuid",
      "visitor_action",
    ].sort(),
  );
  expect(record).toMatchObject({
    platform: "web",
    visitor_action: "consent",
    url: window.location.origin,
    user_preferences: { acceptType: "all", action: "accept_all" },
  });
  await vi.waitFor(() =>
    expect(
      document.querySelector("[data-testid='consent-log']")?.textContent,
    ).toBe("Queued: 0"),
  );
  await act(() => root.unmount());
});

it("an offline POST never blocks the banner or loses the local consent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("offline");
    }),
  );
  const root = await renderAndAccept();
  expect(document.cookie).toContain("cc_consent=v1.");
  expect(
    [...document.querySelectorAll("button")].some((button) =>
      /accept all/i.test(button.textContent ?? ""),
    ),
  ).toBe(false);
  await vi.waitFor(() =>
    expect(
      document.querySelector("[data-testid='consent-log']")?.textContent,
    ).toBe("Queued: 1"),
  );
  expect(localStorage.getItem("cc_consent_queue:acctREDACTED")).toContain(
    '"platform":"web"',
  );
  await act(() => root.unmount());
});
