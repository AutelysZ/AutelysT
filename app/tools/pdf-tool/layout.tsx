import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF Tool - AutelysT",
  description:
    "Merge, split, and reorder PDF files in your browser with no uploads.",
  keywords: ["pdf", "merge", "split", "reorder", "tool"],
};

export default function PdfToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
