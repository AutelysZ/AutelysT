import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JSON Viewer - AutelysT",
  description:
    "Online JSON Viewer with file upload, collapsible tree nodes, and one-click value copy.",
  keywords: [
    "json viewer",
    "json tree",
    "json inspector",
    "json formatter",
    "json parser",
  ],
};

export default function JsonViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
