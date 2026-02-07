import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Base85 / Base91 Encoder/Decoder - AutelysT",
  description:
    "Encode and decode Base85 (Ascii85/Z85) and Base91 with text encoding support.",
  keywords: [
    "base85",
    "ascii85",
    "z85",
    "base91",
    "encoder",
    "decoder",
    "text encoding",
  ],
};

export default function Base85Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
