import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favicon Generator - AutelysT",
  description:
    "Generate favicon .ico files and PNG sets from a single image in your browser.",
  keywords: ["favicon", "ico", "png", "icon", "generator", "web"],
};

export default function FaviconGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
