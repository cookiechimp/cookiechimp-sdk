import { SyncDemo } from "../../components/sync-demo";

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{
    base?: string;
    key?: string;
    region?: string;
    locale?: string;
    timeout?: string;
  }>;
}) {
  const { base, key, region, locale, timeout } = await searchParams;
  return (
    <main>
      <h1>Sync fixture</h1>
      <SyncDemo
        apiBase={base}
        publishableKey={key}
        region={region}
        locale={locale}
        timeoutMs={timeout ? Number(timeout) : undefined}
      />
    </main>
  );
}
