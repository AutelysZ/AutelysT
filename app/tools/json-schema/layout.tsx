import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JSON Schema Generator - AutelysT",
  description:
    "Online JSON Schema generator with automatic type, format, and required-field inference from sample JSON.",
  keywords: [
    "json schema",
    "schema generator",
    "json to schema",
    "json validation",
    "schema inference",
  ],
};

export default function JSONSchemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
