import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HAR Analyzer - AutelysT",
  description:
    "Analyze HAR files for slow requests, transfer size, status breakdown, and host-level traffic patterns.",
  keywords: [
    "har",
    "http archive",
    "network analysis",
    "performance",
    "waterfall",
  ],
};

export default function HarAnalyzerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
