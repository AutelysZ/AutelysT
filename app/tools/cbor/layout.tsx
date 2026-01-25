import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CBOR Codec - AutelysT",
  description:
    "Encode and decode CBOR (Concise Binary Object Representation) with JSON/YAML conversion.",
  keywords: [
    "cbor",
    "concise binary object representation",
    "encode",
    "decode",
    "binary",
    "serialization",
    "json",
    "yaml",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
