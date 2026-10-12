import {
  type PagesConsentProps,
  PagesConsentProvider,
} from "@cookiechimp/nextjs/pages";
import type { AppProps } from "next/app";
import { consentConfig } from "../consent-config";

export default function App({
  Component,
  pageProps,
  router,
}: AppProps<{ cookiechimp?: PagesConsentProps }>) {
  if (router.pathname !== "/legacy" || !pageProps.cookiechimp)
    return <Component {...pageProps} />;
  return (
    <PagesConsentProvider config={consentConfig} {...pageProps.cookiechimp}>
      <Component {...pageProps} />
    </PagesConsentProvider>
  );
}
