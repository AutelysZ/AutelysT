import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Markdown Previewer - AutelysT",
  description:
    "Live Markdown editor with split preview, view modes, URL sync, and history.",
  keywords: ["markdown", "md", "preview", "editor", "render", "live preview"],
};

export default function MarkdownPreviewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
