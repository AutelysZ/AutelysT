import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Snowflake ID Generator/Parser - AutelysT",
  description:
    "Generate and parse Snowflake IDs with timestamp, datacenter, worker, and sequence extraction (Twitter epoch).",
  keywords: [
    "snowflake id",
    "snowflake generator",
    "snowflake parser",
    "twitter snowflake",
    "timestamp",
    "datacenter",
    "worker",
    "sequence",
  ],
}

export default function SnowflakeIdLayout({ children }: { children: React.ReactNode }) {
  return children
}
