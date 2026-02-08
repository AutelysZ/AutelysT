import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Optimizer - AutelysT",
  description:
    "Optimize images by resizing, compressing, and converting to JPEG, PNG, WebP, or AVIF in your browser.",
  keywords: [
    "image optimizer",
    "compress image",
    "resize image",
    "webp",
    "avif",
    "jpeg",
  ],
};

export default function ImageOptimizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
