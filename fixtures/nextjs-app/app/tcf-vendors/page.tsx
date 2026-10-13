import { tcfStubScript } from "@cookiechimp/core/tcf-stub";
import "@cookiechimp/react/tcf.css";
import { TcfVendorsDemo } from "../../components/tcf-vendors-demo";

export default function TcfVendorsPage() {
  return (
    <main>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static stub from the package.
        dangerouslySetInnerHTML={{ __html: tcfStubScript(true) }}
      />
      <h1>TCF vendors fixture</h1>
      <TcfVendorsDemo />
    </main>
  );
}
