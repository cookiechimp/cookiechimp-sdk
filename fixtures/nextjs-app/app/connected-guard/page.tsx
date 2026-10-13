import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import { ConnectedDemo } from "../../components/connected-demo";

export const dynamic = "force-dynamic";

// Production refuses a plain-http platform origin, so this renders the code
// config without making a request.
export default function ConnectedGuardPage() {
  return (
    <CookieChimpProvider
      config={{ categories: [{ id: "local-only", label: "Local only" }] }}
      projectId="acctREDACTED"
      apiBase="http://127.0.0.1:3000"
    >
      <main>
        <h1>Connected guard fixture</h1>
        <ConnectedDemo />
      </main>
    </CookieChimpProvider>
  );
}
