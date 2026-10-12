import { readConsentCookie, readGpc, resolveRegion } from "@cookiechimp/core";
import { cookies, headers } from "next/headers";
import { ConsentDemo } from "../components/consent-demo";
import { ConsentRegion } from "../components/consent-region";

export default async function Home() {
  const requestHeaders = await headers();
  const region = resolveRegion(requestHeaders);
  const gpc = readGpc(requestHeaders);
  const initial = readConsentCookie((await cookies()).toString());
  return (
    <main>
      <h1>CookieChimp Next.js fixture</h1>
      <ConsentRegion region={region} gpc={gpc} initial={initial} />
      <ConsentDemo />
    </main>
  );
}
