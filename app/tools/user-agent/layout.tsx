import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Agent Parser & Builder - AutelysT",
  description:
    "Parse and build User-Agent strings with JSON/table views, copy-ready output, and history support.",
  keywords: [
    "user agent",
    "user-agent",
    "ua parser",
    "ua builder",
    "browser detection",
    "http header",
  ],
};

export default function UserAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
