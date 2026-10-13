import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useTranslations } from "@cookiechimp/react";
import en from "@cookiechimp/translations/en";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ClientProvider } from "./index";

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../core/src/fixtures/platform-offline-bundle.json"),
    "utf8",
  ),
);
beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  localStorage.clear();
});

function Title() {
  const { t } = useTranslations(en);
  return <h2>{t("banner.title")}</h2>;
}
const config = { categories: { analytics: false } };
const sync = {
  projectId: fixture.account_hashid,
  apiBase: "https://api.cookiechimp.test",
  locale: "en",
  region: "US",
  etag: '"server-version"',
};

async function mount() {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <ClientProvider
        config={config}
        messages={{ ...en, "banner.title": "Server copy" }}
        sync={sync}
      >
        <Title />
      </ClientProvider>,
    ),
  );
  return { container, root };
}

describe("ClientProvider revalidates after hydration", () => {
  it("sends the server etag, and a 304 keeps the server copy", async () => {
    const fetch = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 304 }),
    );
    vi.stubGlobal("fetch", fetch);
    const { container, root } = await mount();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      `https://api.cookiechimp.test/api/v1/mobile-sdk/offline/${sync.projectId}`,
    );
    expect(init).toMatchObject({ credentials: "omit" });
    expect(
      ((init?.headers ?? {}) as Record<string, string>)["If-None-Match"],
    ).toBe('"server-version"');
    await act(async () => {});
    expect(container.textContent).toBe("Server copy");
    await act(async () => root.unmount());
  });

  it("shows newer dashboard copy without a reload", async () => {
    const newer = structuredClone(fixture);
    newer.cache_version = "newer";
    newer.translations.bnrUS1.en.consent_modal.title = "Fresh dashboard copy";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(newer)),
    );
    const { container, root } = await mount();
    await vi.waitFor(() =>
      expect(container.textContent).toBe("Fresh dashboard copy"),
    );
    await act(async () => root.unmount());
  });

  it("makes no request without a sync seed", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ClientProvider config={config}>
          <Title />
        </ClientProvider>,
      ),
    );
    await new Promise((done) => setTimeout(done, 50));
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
