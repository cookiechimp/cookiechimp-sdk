import { ConsentDemo } from "../../components/consent-demo";
import { EndpointLogDemo } from "../../components/endpoint-log-demo";

export default async function EndpointLogPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const endpoint = run
    ? `/api/consent?run=${encodeURIComponent(run)}`
    : "/api/consent";
  return (
    <main>
      <h1>Self-hosted endpoint fixture</h1>
      <ConsentDemo />
      <EndpointLogDemo endpoint={endpoint} />
    </main>
  );
}
