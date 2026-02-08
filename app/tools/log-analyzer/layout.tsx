import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log Analyzer - AutelysT",
  description:
    "Parse and summarize access logs, JSON logs, and mixed log streams for errors and traffic patterns.",
  keywords: [
    "log analyzer",
    "access log",
    "error log",
    "nginx",
    "apache",
    "observability",
  ],
};

export default function LogAnalyzerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
