import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Agent Parser - AutelysT",
  description:
    "Parse and analyze user agent strings to detect browser, operating system, device type, and more.",
  keywords: [
    "user agent",
    "user agent parser",
    "browser detection",
    "device detection",
    "os detection",
    "ua parser",
    "bot detection",
  ],
};

export default function UserAgentParserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
