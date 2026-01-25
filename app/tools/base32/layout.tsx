import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Base32 Encoder/Decoder - AutelysT",
  description:
    "Online Base32 encoder/decoder for TOTP and file systems with text encoding selection and file input.",
  keywords: ["base32", "encoder", "decoder", "totp", "2fa", "text encoding"],
};

export default function Base32Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
