import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "URL Encoder/Decoder - AutelysT",
  description:
    "Free online URL encoder and decoder. Encode and decode URL strings with detailed parsing of protocol, hostname, pathname, search params, and hash params.",
  keywords: ["url encoder", "url decoder", "percent encoding", "uri encode", "query string", "url parser"],
}

export default function URLEncodeLayout({ children }: { children: React.ReactNode }) {
  return children
}
