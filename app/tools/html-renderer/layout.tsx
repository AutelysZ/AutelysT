import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML Renderer - AutelysT",
  description:
    "Live HTML editor with real-time iframe preview. Edit HTML code and see instant rendered output.",
  keywords: [
    "html renderer",
    "html editor",
    "live preview",
    "iframe",
    "html viewer",
    "web editor",
  ],
};

export default function HtmlRendererLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
