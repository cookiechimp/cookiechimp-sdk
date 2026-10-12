import { withConsent } from "@cookiechimp/nextjs/pages";
import { ConsentDemo } from "../components/consent-demo";
import { consentConfig } from "../consent-config";

export default function LegacyPage() {
  return (
    <main>
      <h1>Pages Router</h1>
      <ConsentDemo />
    </main>
  );
}

export const getServerSideProps = withConsent({
  config: consentConfig,
  provider: "cloudflare",
  languages: { available: ["en", "de", "fr"], fallback: "en" },
});
