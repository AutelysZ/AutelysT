import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "URL Encoder/Decoder - AutelysT",
  description: "Online URL encoder/decoder with detailed parsing of protocol, host, path, query, and hash parameters.",
  keywords: ["url encoder", "url decoder", "percent encoding", "uri", "query string", "url parser", "hash params"],
}

export default function URLEncodeLayout({ children }: { children: React.ReactNode }) {
  return children
}
