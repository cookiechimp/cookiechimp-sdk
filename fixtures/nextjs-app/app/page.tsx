import { readConsentCookie } from "@cookiechimp/core";
import {
  readGpc,
  regulationFor,
  resolveRegion,
} from "@cookiechimp/core/regions";
import { cookies, headers } from "next/headers";
import { ConsentDemo } from "../components/consent-demo";
import { ConsentRegion } from "../components/consent-region";

export default async function Home() {
  const requestHeaders = await headers();
  const region = resolveRegion(requestHeaders, { provider: "vercel" });
  const gpc = readGpc(requestHeaders);
  const initial = readConsentCookie((await cookies()).toString());
  return (
    <main>
      <h1>CookieChimp Next.js fixture</h1>
      <ConsentRegion
        region={region}
        regulation={regulationFor(region)}
        gpc={gpc}
        initial={initial}
      />
      <ConsentDemo initialState={initial} />
    </main>
  );
}
