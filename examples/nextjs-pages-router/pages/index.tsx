import {
  type PagesConsentProps,
  PagesConsentProvider,
  withConsent,
} from "@cookiechimp/nextjs/pages";
import { ConsentStatus } from "../components/consent-status";
import { ConsentUi } from "../components/consent-ui";
import { consentConfig } from "../cookiechimp.config";

// Reads the consent cookie on the server, so the first HTML already matches.
export const getServerSideProps = withConsent({ config: consentConfig });

export default function Home({
  cookiechimp,
}: {
  cookiechimp: PagesConsentProps;
}) {
  return (
    <PagesConsentProvider config={consentConfig} {...cookiechimp}>
      <main>
        <h1>CookieChimp Pages Router example</h1>
        <ConsentStatus />
      </main>
      <ConsentUi />
    </PagesConsentProvider>
  );
}
