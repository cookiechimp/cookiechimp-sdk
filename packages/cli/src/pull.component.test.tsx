// @vitest-environment happy-dom
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { adaptPlatformConfig } from "@cookiechimp/core/sync";
import { ConsentProvider, useHeadlessContext } from "@cookiechimp/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { runPull } from "./remote";

const fixture = readFileSync(
  resolve(__dirname, "../../core/src/fixtures/platform-offline-bundle.json"),
  "utf8",
);
const root = realpathSync(mkdtempSync(join(tmpdir(), "cc-pull-ui-")));
writeFileSync(
  join(root, "package.json"),
  JSON.stringify({ dependencies: { react: "19.3.0", vite: "7.0.0" } }),
);
afterEach(() => document.body.replaceChildren());
afterEach(() => rmSync(root, { recursive: true, force: true }));

function Categories() {
  const consent = useHeadlessContext()?.consent;
  return (
    <ul>
      {Object.keys(consent?.get().categories ?? {}).map((id) => (
        <li key={id}>{id}</li>
      ))}
    </ul>
  );
}

it("a pulled config renders offline through adaptPlatformConfig and the provider", async () => {
  const bundle = JSON.parse(fixture);
  const projectId = bundle.account_hashid as string;
  await runPull(
    { cwd: root, project: projectId },
    {
      env: {},
      fetch: vi.fn(async () => new Response(fixture)),
    },
  );
  const saved = JSON.parse(
    readFileSync(join(root, "cookiechimp.config.json"), "utf8"),
  );
  const dashboard = adaptPlatformConfig(saved, { projectId, locale: "de" });
  expect(dashboard?.accountId).toBe(projectId);
  const container = document.createElement("div");
  document.body.append(container);
  const view = createRoot(container);
  await act(() =>
    view.render(
      <ConsentProvider config={{ categories: dashboard?.categories ?? [] }}>
        <h2>
          {String((dashboard?.copy.consent_modal as { title?: string })?.title)}
        </h2>
        <Categories />
      </ConsentProvider>,
    ),
  );
  expect(container.querySelector("h2")?.textContent).not.toBe("undefined");
  const rendered = [...container.querySelectorAll("li")].map(
    (item) => item.textContent,
  );
  for (const category of dashboard?.categories ?? [])
    expect(rendered).toContain(category.id);
  await act(() => view.unmount());
});
