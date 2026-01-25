import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "CSP Builder - AutelysT",
  description: "Build and edit Content-Security-Policy headers with directive-aware editing.",
  keywords: ["csp", "content security policy", "security header", "script-src", "nonce", "builder"],
}

export default function CspBuilderLayout({ children }: { children: React.ReactNode }) {
  return children
}
