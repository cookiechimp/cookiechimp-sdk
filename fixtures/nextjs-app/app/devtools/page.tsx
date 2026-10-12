import { DevtoolsDemo } from "../../components/devtools-demo";

export default async function DevtoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ guard?: string }>;
}) {
  // The fixture is a production build, so it opts in unless ?guard=1 checks the default.
  const allowProduction = (await searchParams).guard !== "1";
  return (
    <main>
      <h1>Devtools fixture</h1>
      <DevtoolsDemo allowProduction={allowProduction} />
    </main>
  );
}
