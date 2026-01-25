import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Punycode Encoder/Decoder - AutelysT",
  description:
    "Online Punycode encoder/decoder for internationalized domain names (IDN) with domain and raw label modes.",
  keywords: [
    "punycode",
    "idn",
    "internationalized domain name",
    "unicode domain",
    "xn--",
    "domain encoder",
    "domain decoder",
  ],
};

export default function PunycodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
