import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Source Map Viewer - AutelysT",
  description: "View and download source files from source maps with a tree explorer and syntax-highlighted preview.",
  keywords: ["source map", "sourcemap", "viewer", "debug", "stack trace", "monaco"],
}

export default function SourceMapViewerLayout({ children }: { children: React.ReactNode }) {
  return children
}
