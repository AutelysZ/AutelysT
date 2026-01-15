import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JSON Diff Viewer - AutelysT",
  description:
    "Compare two JSON files or inputs and view differences. Supports file upload and detailed change tracking.",
  keywords: ["json diff", "json compare", "diff viewer", "json comparison", "file diff"],
}

export default function JSONDiffLayout({ children }: { children: React.ReactNode }) {
  return children
}
