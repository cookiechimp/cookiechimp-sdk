import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import { ConnectedDemo } from "../../components/connected-demo";

export const dynamic = "force-dynamic";

// No server transport override: the server fetch to the (unreachable) test
// origin falls back to the code config, and the browser revalidates after
// hydration against the origin the e2e test intercepts.
export default function ConnectedLivePage() {
  return (
    <CookieChimpProvider
      config={{ categories: [{ id: "local-only", label: "Local only" }] }}
      region={{ country: "US" }}
      languages={{ available: ["en"], fallback: "en" }}
      projectId="acctREDACTED"
      apiBase="https://api.cookiechimp.test"
    >
      <main>
        <h1>Connected live fixture</h1>
        <ConnectedDemo />
      </main>
    </CookieChimpProvider>
  );
}
