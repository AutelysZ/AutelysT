import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "KSUID Generator/Parser - AutelysT",
  description: "Online KSUID generator and parser with timestamp and payload extraction.",
  keywords: ["ksuid", "ksuid generator", "ksuid parser", "sortable identifier", "timestamp"],
}

export default function KSUIDLayout({ children }: { children: React.ReactNode }) {
  return children
}
