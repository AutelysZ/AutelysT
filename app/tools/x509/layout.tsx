import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "X.509 Certificate Tool - AutelysT",
  description: "Create, view, validate, and convert X.509 certificates with PEM, DER, and PKCS#12 support.",
  keywords: ["x509", "certificate", "pem", "der", "pkcs12", "p12", "openssl", "ca", "tls"],
}

export default function X509Layout({ children }: { children: React.ReactNode }) {
  return children
}
