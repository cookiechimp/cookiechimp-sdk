import { CookieChimpProvider, GppStub } from "@cookiechimp/nextjs/server";
import { GppProviderDemo } from "../../components/gpp-provider-demo";

export const dynamic = "force-dynamic";

// Early vendor tag: must be answered by the stub, then adopted by the lazy API.
const vendorScript = `window.__gppEvents=[];window.__gpp("addEventListener",function(e){window.__gppEvents.push(e.eventName)});`;

export default async function GppProviderPage({
  searchParams,
}: {
  searchParams: Promise<{ off?: string }>;
}) {
  const { off } = await searchParams;
  return (
    <CookieChimpProvider
      config={{
        categories: { advertising: false, marketing: false },
        cookie: { name: "cc_gpp_provider_fixture" },
      }}
      region={{ country: "US", region: "CA" }}
      gpp={off ? undefined : { values: { usca: { SaleOptOutNotice: 1 } } }}
    >
      {!off && <GppStub />}
      {!off && (
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static fixture vendor tag.
          dangerouslySetInnerHTML={{ __html: vendorScript }}
        />
      )}
      <main>
        <h1>GPP provider fixture</h1>
        <GppProviderDemo />
      </main>
    </CookieChimpProvider>
  );
}
