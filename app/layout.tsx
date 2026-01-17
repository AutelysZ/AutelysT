import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/app-shell/app-shell"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title: {
    default: "AutelysT - AI-Powered Web Toolkit",
    template: "%s | AutelysT",
  },
  description:
    "A comprehensive collection of free online tools for encoding, decoding, number conversion, text manipulation, and more.",
  keywords: ["web tools", "encoder", "decoder", "base64", "converter", "online tools"],
  authors: [{ name: "AutelysT" }],
  icons: {
    icon: "/images/autelys.png",
    apple: "/images/autelys.png",
  },
  openGraph: {
    type: "website",
    siteName: "AutelysT",
    title: "AutelysT - AI-Powered Web Toolkit",
    description:
      "A comprehensive collection of free online tools for encoding, decoding, number conversion, text manipulation, and more.",
  },
  other: {
    "opensearch-type": "application/opensearchdescription+xml",
    "opensearch-title": "AutelysT",
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="search" type="application/opensearchdescription+xml" title="AutelysT" href="/opensearch.xml" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
