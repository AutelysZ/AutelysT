import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "URL Escape Encoder/Decoder - AutelysT",
  description:
    "Online URL escape encoder/decoder for percent-encoding (%XX format) with input encoding selection, encoding modes, and case control.",
  keywords: [
    "url escape",
    "percent encoding",
    "encoder",
    "decoder",
    "%21",
    "%20",
    "uri encoding",
    "url encoding",
    "base64 to url",
  ],
}

export default function UrlEscapeLayout({ children }: { children: React.ReactNode }) {
  return children
}
