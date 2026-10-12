import { ConsentDemo } from "../components/consent-demo";
import { ConsentRegion } from "../components/consent-region";

export default function Home() {
  return (
    <main>
      <h1>CookieChimp Next.js fixture</h1>
      <ConsentRegion />
      <ConsentDemo />
    </main>
  );
}
