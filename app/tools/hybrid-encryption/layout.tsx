import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hybrid Encryption (CMS/OpenPGP/JWE/HPKE) - AutelysT",
  description:
    "Hybrid encryption tool for CMS, OpenPGP, JWE, and HPKE with in-browser encrypt/decrypt flows and flexible key handling.",
  keywords: [
    "hybrid encryption",
    "cms",
    "pkcs7",
    "openpgp",
    "jwe",
    "hpke",
    "encrypt",
    "decrypt",
    "key management",
  ],
};

export default function HybridEncryptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
