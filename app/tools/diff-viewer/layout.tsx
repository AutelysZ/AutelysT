import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Diff Viewer - AutelysT",
  description: "Online diff viewer for text, JSON, YAML, and TOML with table view, unified diff, and character-level highlights.",
  keywords: ["diff viewer", "text diff", "json diff", "yaml diff", "toml diff", "unified diff", "table diff"],
}

export default function DiffViewerLayout({ children }: { children: React.ReactNode }) {
  return children
}
