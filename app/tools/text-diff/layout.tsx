import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Text Diff Viewer - AutelysT",
  description: "Compare two text files or inputs and view differences line by line. Supports file upload.",
  keywords: ["text diff", "text compare", "diff viewer", "file comparison", "line diff"],
}

export default function TextDiffLayout({ children }: { children: React.ReactNode }) {
  return children
}
