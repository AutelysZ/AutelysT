import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "File Type Detector - AutelysT",
  description: "Detect file types with file-type and preview printable files.",
  keywords: [
    "file type",
    "mime",
    "detector",
    "file signature",
    "preview",
    "file-type",
  ],
};

export default function FileTypeDetectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
