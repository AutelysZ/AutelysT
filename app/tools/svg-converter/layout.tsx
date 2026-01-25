import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SVG to PNG Converter - AutelysT",
  description:
    "Convert SVG to PNG with custom dimensions. Upload or paste SVG code, edit in real-time, and download as PNG.",
  keywords: [
    "svg",
    "png",
    "converter",
    "svg to png",
    "image converter",
    "svg editor",
    "resize",
    "download",
  ],
};

export default function SvgConverterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
