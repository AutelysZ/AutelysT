import X509Client from "./x509-client";

export default function X509Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tabParam = searchParams?.tab;
  const initialTab = typeof tabParam === "string" ? tabParam : undefined;
  return <X509Client initialTab={initialTab} />;
}
