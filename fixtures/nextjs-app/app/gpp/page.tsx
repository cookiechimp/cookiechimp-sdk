import { gppStubScript } from "@cookiechimp/core/gpp-stub";
import { GppDemo } from "../../components/gpp-demo";

// A vendor tag that calls __gpp before the CMP has loaded: its calls must be
// answered by the stub and its listener adopted by the full API.
const vendorScript = `window.__gppEvents=[];window.__gpp("addEventListener",function(e){window.__gppEvents.push(e.eventName+":"+JSON.stringify(e.data))});`;

export default async function GppPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; approach?: string }>;
}) {
  const { region, approach } = await searchParams;
  return (
    <main>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static stub from the package.
        dangerouslySetInnerHTML={{ __html: gppStubScript }}
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static fixture vendor tag.
        dangerouslySetInnerHTML={{ __html: vendorScript }}
      />
      <h1>GPP fixture</h1>
      <GppDemo
        region={/^[A-Z]{2}$/.test(region ?? "") ? region : undefined}
        national={approach === "national"}
      />
    </main>
  );
}
