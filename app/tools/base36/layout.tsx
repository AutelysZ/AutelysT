import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Base36 Encoder/Decoder - AutelysT",
  description:
    "Online Base36 encoder/decoder with text encoding selection, case control, and file input.",
  keywords: [
    "base36",
    "encoder",
    "decoder",
    "alphanumeric",
    "text encoding",
    "case",
  ],
};

export default function Base36Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
