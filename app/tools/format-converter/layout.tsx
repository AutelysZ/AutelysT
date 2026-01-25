import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Format Converter - AutelysT",
  description:
    "Online JSON/YAML/TOML converter with auto-detection and error reporting.",
  keywords: [
    "format converter",
    "json to yaml",
    "yaml to json",
    "json to toml",
    "toml to json",
  ],
};

export default function FormatConverterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
