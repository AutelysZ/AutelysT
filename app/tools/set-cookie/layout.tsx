import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set-Cookie Builder & Parser - AutelysT",
  description:
    "Build and parse Set-Cookie headers with a dual-panel editor and SPDX-style JSON output.",
  keywords: [
    "set-cookie",
    "cookie header",
    "cookie parser",
    "set-cookie builder",
    "http cookie",
    "sameSite",
    "httpOnly",
    "secure",
  ],
};

export default function SetCookieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
