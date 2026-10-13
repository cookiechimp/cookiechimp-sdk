import { SyncDemo } from "../../components/sync-demo";

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string; key?: string }>;
}) {
  const { base, key } = await searchParams;
  return (
    <main>
      <h1>Sync fixture</h1>
      <SyncDemo apiBase={base} publishableKey={key} />
    </main>
  );
}
