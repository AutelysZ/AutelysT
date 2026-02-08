import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SemVer Tool - AutelysT",
  description:
    "Compare semantic versions, evaluate version ranges, increment releases, and sort version lists.",
  keywords: [
    "semver",
    "semantic versioning",
    "version range",
    "compare versions",
    "npm version",
  ],
};

export default function SemverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
