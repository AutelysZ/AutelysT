import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "BSON ObjectID Generator/Parser - AutelysT",
  description: "Online BSON ObjectID generator and parser with timestamp, machine ID, and counter fields.",
  keywords: ["objectid", "bson", "mongodb", "objectid generator", "objectid parser", "timestamp"],
}

export default function ObjectIdLayout({ children }: { children: React.ReactNode }) {
  return children
}
