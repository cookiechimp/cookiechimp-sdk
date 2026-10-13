import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import { ConnectedDemo } from "../../components/connected-demo";
import bundle from "./bundle.json";

// Serves the redacted platform bundle in place of https://cookiechimp.com,
// so the real server fetch, validation and SSR path run without a network.
const platform: typeof fetch = async (input) => {
  const url = String(input);
  return url.endsWith(`/api/v1/mobile-sdk/offline/${bundle.account_hashid}`)
    ? Response.json(bundle)
    : new Response('{"error":"not found"}', { status: 404 });
};

export const dynamic = "force-dynamic";

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  return (
    <CookieChimpProvider
      config={{ categories: [{ id: "local-only", label: "Local only" }] }}
      region={{ country: "DE" }}
      languages={{ available: ["en", "de"], fallback: "de" }}
      projectId={project ?? bundle.account_hashid}
      fetch={platform}
    >
      <main>
        <h1>Connected server config fixture</h1>
        <ConnectedDemo />
      </main>
    </CookieChimpProvider>
  );
}
