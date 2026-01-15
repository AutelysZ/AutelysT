import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Format Converter - AutelysT",
  description: "Free online format converter. Convert between JSON, YAML, and TOML formats instantly.",
  keywords: ["json to yaml", "yaml to json", "toml converter", "format converter", "json yaml toml"],
}

export default function FormatConverterLayout({ children }: { children: React.ReactNode }) {
  return children
}
