import { ConsentDemo } from "../../components/consent-demo";

export default function StrictCspPage() {
  return (
    <main>
      <link rel="stylesheet" href="/cookiechimp.css" />
      <h1>Strict CSP styles</h1>
      <ConsentDemo />
    </main>
  );
}
