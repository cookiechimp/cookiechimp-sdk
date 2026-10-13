import { ConsentDemo } from "../../components/consent-demo";
import { ConsentLogDemo } from "../../components/consent-log-demo";

export default async function ConsentLogPage({
  searchParams,
}: {
  searchParams: Promise<{ delay?: string }>;
}) {
  const { delay } = await searchParams;
  return (
    <main>
      <h1>Consent log fixture</h1>
      <ConsentDemo />
      <ConsentLogDemo baseDelayMs={delay ? Number(delay) : undefined} />
    </main>
  );
}
