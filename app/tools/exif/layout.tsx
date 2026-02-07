import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exif Tool - AutelysT",
  description:
    "View, edit, and strip EXIF metadata from images entirely in your browser.",
  keywords: ["exif", "metadata", "image", "jpeg", "strip exif", "edit exif"],
};

export default function ExifLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
