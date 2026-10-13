import { tcfStubScript } from "@cookiechimp/core/tcf-stub";
import { TcfDemo } from "../../components/tcf-demo";

// A vendor tag calling __tcfapi before the CMP loads.
const vendorScript = `window.__tcfEvents=[];window.__tcfapi("addEventListener",2,function(d,ok){window.__tcfEvents.push({ok:ok,eventStatus:d&&d.eventStatus,tcString:d&&d.tcString})});`;

export default async function TcfPage({
  searchParams,
}: {
  searchParams: Promise<{ cmp?: string; gvl?: string; region?: string }>;
}) {
  const { cmp, gvl, region } = await searchParams;
  const country = /^[A-Z]{2}$/.test(region ?? "") ? (region as string) : "IE";
  return (
    <main>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static stub from the package.
        dangerouslySetInnerHTML={{ __html: tcfStubScript(country === "IE") }}
      />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static fixture vendor tag.
        dangerouslySetInnerHTML={{ __html: vendorScript }}
      />
      <h1>TCF fixture</h1>
      <TcfDemo
        // 300 is a fixture-only placeholder, not an IAB assigned CMP ID.
        cmpId={cmp === "none" ? undefined : 300}
        invalidGvl={gvl === "invalid"}
        country={country}
      />
    </main>
  );
}
