import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JSON Schema Generator - AutelysT",
  description: "Generate JSON Schema from sample JSON data. Automatically infer types, formats, and required fields.",
  keywords: ["json schema", "schema generator", "json to schema", "json validation", "json schema draft"],
}

export default function JSONSchemaLayout({ children }: { children: React.ReactNode }) {
  return children
}
