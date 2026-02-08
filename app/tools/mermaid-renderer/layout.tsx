import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mermaid Renderer - AutelysT",
  description:
    "Render Mermaid diagrams to SVG and PNG in-browser with configurable themes and export controls.",
  keywords: [
    "mermaid",
    "diagram",
    "flowchart",
    "sequence diagram",
    "svg",
    "png",
  ],
};

export default function MermaidRendererLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
