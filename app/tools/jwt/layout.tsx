import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JWT Parser/Generator",
  description: "Parse, edit, and generate JSON Web Tokens with signature validation.",
  keywords: ["jwt", "json web token", "parser", "generator", "signature", "claims"],
}

export default function JwtLayout({ children }: { children: React.ReactNode }) {
  return children
}
