import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "BSON ObjectID - AutelysT",
  description: "Generate and parse MongoDB BSON ObjectIDs. Extract timestamp, machine ID, and counter information.",
  keywords: ["objectid", "mongodb", "bson", "generator", "parser", "timestamp"],
}

export default function ObjectIdLayout({ children }: { children: React.ReactNode }) {
  return children
}
