import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Base58 Encoder/Decoder - AutelysT",
  description:
    "Online Base58 encoder/decoder for Bitcoin and IPFS with raw byte file support.",
  keywords: ["base58", "encoder", "decoder", "bitcoin", "ipfs", "binary"],
};

export default function Base58Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
