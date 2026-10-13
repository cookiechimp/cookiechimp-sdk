import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useTranslations } from "@cookiechimp/react";
import en from "@cookiechimp/translations/en";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ClientProvider } from "./index";
import { getServerConfig } from "./server-config";

const fixture = readFileSync(
  resolve(__dirname, "../../core/src/fixtures/platform-offline-bundle.json"),
  "utf8",
);

function Title() {
  const { t } = useTranslations(en);
  return <h2>{t("banner.title")}</h2>;
}

it("server config output hydrates without a mismatch", async () => {
  const server = await getServerConfig({
    projectId: JSON.parse(fixture).account_hashid,
    fetch: async () => new Response(fixture),
    region: { country: "DE" },
    locale: "de",
  });
  const app = (
    <ClientProvider
      config={{
        categories: server.config.categories,
        services: server.config.services,
      }}
      language="de"
      messages={{ ...en, ...server.messages }}
    >
      <Title />
    </ClientProvider>
  );
  const html = renderToString(app);
  expect(html).toContain("Wir respektieren Ihre Privatsphäre");
  const target = document.body.appendChild(document.createElement("div"));
  target.innerHTML = html;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(target, app);
  });
  expect(error).not.toHaveBeenCalled();
  expect(target.textContent).toContain("Wir respektieren Ihre Privatsphäre");
  error.mockRestore();
  await act(async () => root?.unmount());
});
