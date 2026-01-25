import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Key Extractor - AutelysT",
  description:
    "Online key extractor to parse and convert PEM, JWK, and DER keys with algorithm detection and downloadable exports.",
  keywords: [
    "key extractor",
    "key parser",
    "pem",
    "jwk",
    "der",
    "key conversion",
    "rsa",
    "ec",
    "okp",
  ],
};

export default function KeyExtractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
