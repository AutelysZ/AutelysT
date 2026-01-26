import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Code Formatter - AutelysT",
  description:
    "Format code with Prettier across many languages using a file tree and Monaco editor.",
  keywords: [
    "code formatter",
    "prettier",
    "format",
    "beautify",
    "editor",
    "monaco",
  ],
};

export default function CodeFormatterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
