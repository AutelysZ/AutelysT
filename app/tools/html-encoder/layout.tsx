import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "HTML Escape - AutelysT",
  description: "Online HTML escape/unescape tool with two-way editing and entity conversion.",
  keywords: ["html escape", "html unescape", "html entities", "escape", "unescape", "html encoder"],
}

export default function HtmlEncoderLayout({ children }: { children: React.ReactNode }) {
  return children
}
