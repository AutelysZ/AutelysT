import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "HTML Encoder/Decoder",
  description: "Encode plain text to HTML entities or decode HTML back to readable text.",
  keywords: ["html", "encoder", "decoder", "entities", "escape", "unescape"],
}

export default function HtmlEncoderLayout({ children }: { children: React.ReactNode }) {
  return children
}
