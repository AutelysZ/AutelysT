import type { Metadata, Viewport } from "next";
import { tools } from "@/lib/tools/registry";

const tool = tools.find((t) => t.id === "gzip")!;

export const metadata: Metadata = {
  title: tool.seo?.title ?? `${tool.name} - AutelysT`,
  description: tool.seo?.description ?? tool.description,
  keywords: tool.seo?.keywords ?? tool.keywords,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function GzipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
