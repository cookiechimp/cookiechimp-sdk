import { TcfStub } from "@cookiechimp/nextjs/server";
import "@cookiechimp/react/tcf.css";
import { TcfProviderDemo } from "../../components/tcf-provider-demo";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const mode = ["disabled", "missing-id", "invalid"].includes(params.mode ?? "")
    ? (params.mode as string)
    : "ready";
  return (
    <main>
      <h1>Opt-in TCF provider fixture</h1>
      {mode !== "disabled" ? <TcfStub nonce="fixture-nonce" /> : null}
      <TcfProviderDemo mode={mode} />
    </main>
  );
}
