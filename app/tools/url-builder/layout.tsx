import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "URL Builder - AutelysT",
  description: "Parse and rebuild URLs with editable components, hash query support, and custom encodings.",
  keywords: ["url builder", "url parser", "query params", "hash params", "encoding", "gbk"],
}

export default function UrlBuilderLayout({ children }: { children: React.ReactNode }) {
  return children
}
