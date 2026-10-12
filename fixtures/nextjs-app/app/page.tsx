import { readConsentCookie } from "@cookiechimp/core";
import { resolveLanguage } from "@cookiechimp/core/language";
import {
  readGpc,
  regulationFor,
  resolveRegion,
} from "@cookiechimp/core/regions";
import type { Messages } from "@cookiechimp/translations";
import de from "@cookiechimp/translations/de";
import en from "@cookiechimp/translations/en";
import fr from "@cookiechimp/translations/fr";
import { cookies, headers } from "next/headers";
import { ConsentDemo } from "../components/consent-demo";
import { ConsentRegion } from "../components/consent-region";

export default async function Home() {
  const requestHeaders = await headers();
  const region = resolveRegion(requestHeaders, { provider: "vercel" });
  const gpc = readGpc(requestHeaders);
  const initial = readConsentCookie((await cookies()).toString());
  const language = resolveLanguage(
    requestHeaders.get("accept-language"),
    ["en", "de", "fr"],
    "en",
  );
  const translations =
    ({ en, de, fr } as Record<string, Messages>)[language] ?? en;
  return (
    <main>
      <h1>CookieChimp Next.js fixture</h1>
      <ConsentRegion
        region={region}
        regulation={regulationFor(region)}
        gpc={gpc}
        initial={initial}
      />
      <ConsentDemo
        initialState={initial}
        language={language}
        translations={translations}
      />
    </main>
  );
}
