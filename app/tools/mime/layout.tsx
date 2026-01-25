import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MIME Lookup - AutelysT",
  description:
    "Lookup MIME types by filename and list known extensions for MIME types.",
  keywords: [
    "mime",
    "mime type",
    "content type",
    "file extension",
    "lookup",
  ],
};

export default function MimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
