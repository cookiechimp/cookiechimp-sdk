import { EndpointPropDemo } from "../../components/endpoint-prop-demo";

export default async function EndpointPropPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const url = run
    ? `/api/consent?run=${encodeURIComponent(run)}`
    : "/api/consent";
  return (
    <main>
      <h1>Provider endpoint fixture</h1>
      <EndpointPropDemo url={url} />
    </main>
  );
}
