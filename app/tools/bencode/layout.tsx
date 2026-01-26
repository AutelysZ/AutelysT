import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bencode Encoder/Decoder - AutelysT",
  description:
    "Encode and decode Bencode data with JSON/YAML conversion, file input, and type details.",
  keywords: [
    "bencode",
    "bittorrent",
    "torrent",
    "encode",
    "decode",
    "binary",
    "json",
    "yaml",
  ],
};

export default function BencodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
