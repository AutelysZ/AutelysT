import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Key Derivation (HKDF/PBKDF2) - AutelysT",
  description:
    "Derive keys with HKDF or PBKDF2, configurable hash and salt, and Base64/Base64url/Hex output encodings.",
  keywords: [
    "key derivation",
    "hkdf",
    "pbkdf2",
    "salt",
    "hash",
    "base64",
    "hex",
  ],
};

export default function KeyDerivationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
