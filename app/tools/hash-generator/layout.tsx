import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hash Generator - AutelysT",
  description:
    "Online hash generator with MD2/MD4/MD5, SHA-1/2/3, and BLAKE2/3 plus hex/base64 outputs and file support.",
  keywords: [
    "hash generator",
    "digest",
    "md5",
    "sha256",
    "sha3",
    "blake2",
    "blake3",
    "checksum",
    "file hash",
  ],
};

export default function HashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
