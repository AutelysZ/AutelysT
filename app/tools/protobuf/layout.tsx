import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Protobuf Codec - AutelysT",
  description:
    "Encode and decode Protocol Buffers with or without schema definition.",
  keywords: [
    "protobuf",
    "protocol buffers",
    "encode",
    "decode",
    "schema",
    "binary",
    "serialization",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
