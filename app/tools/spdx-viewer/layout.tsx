import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SPDX Viewer - AutelysT",
  description:
    "Validate SPDX license expressions and inspect SPDX JSON documents, package licenses, and identifiers.",
  keywords: [
    "spdx viewer",
    "spdx",
    "sbom",
    "software bill of materials",
    "license expression",
    "open source license",
    "license id",
  ],
};

export default function SpdxViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
