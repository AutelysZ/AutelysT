import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "MessagePack Codec - AutelysT",
  description: "Encode and decode MessagePack binary format with JSON/YAML conversion.",
  keywords: ["messagepack", "msgpack", "encode", "decode", "binary", "serialization", "json", "yaml"],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
