import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unicode Normalizer - AutelysT",
  description:
    "Normalize Unicode text with NFC/NFD/NFKC/NFKD, inspect code points, and detect confusable characters.",
  keywords: [
    "unicode",
    "normalize",
    "nfc",
    "nfkc",
    "code points",
    "confusable",
  ],
};

export default function UnicodeNormalizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
