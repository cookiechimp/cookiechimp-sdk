import { StylesLink } from "@cookiechimp/nextjs/styles-route";
import { headers } from "next/headers";
import { ConsentDemo } from "../../components/consent-demo";

export default async function StrictCspPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <main>
      <StylesLink nonce={nonce} />
      <h1>Strict CSP styles</h1>
      <ConsentDemo />
    </main>
  );
}
