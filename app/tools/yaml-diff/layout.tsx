import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "YAML Diff Viewer - AutelysT",
  description: "Free online YAML diff viewer. Compare two YAML files or inputs and view differences.",
  keywords: ["yaml diff", "yaml compare", "diff viewer", "yaml comparison"],
}

export default function YAMLDiffLayout({ children }: { children: React.ReactNode }) {
  return children
}
