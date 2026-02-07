import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NanoID Generator - AutelysT",
  description:
    "Generate NanoIDs with custom alphabets, lengths, and batch sizes.",
  keywords: [
    "nanoid",
    "id generator",
    "unique id",
    "custom alphabet",
    "url-safe",
  ],
};

export default function NanoIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
