import { PresetsDemo } from "../../components/presets-demo";

export default async function PresetsPage({
  searchParams,
}: {
  searchParams: Promise<{ gtm?: string }>;
}) {
  const advanced = (await searchParams).gtm === "advanced";
  return (
    <main>
      <h1>Google preset fixture</h1>
      <PresetsDemo advanced={advanced} />
    </main>
  );
}
