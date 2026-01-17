import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "HTML Encoder/Decoder - AutelysT",
  description: "Online HTML encoder/decoder with two-way editing and entity escape/unescape.",
  keywords: ["html encoder", "html decoder", "html entities", "escape", "unescape"],
}

export default function HtmlEncoderLayout({ children }: { children: React.ReactNode }) {
  return children
}
